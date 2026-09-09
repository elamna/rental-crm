import { NextRequest, NextResponse } from "next/server";
import { requireAuth, apiError, ApiError } from "@/lib/auth";
import { latestDebtCheck, saveDebtCheck } from "@/lib/repo";
import { callRegistry, isEgovConfigured, isValidIdentifier, parseDebtResponse } from "@/lib/egov";

/** Через сколько дней проверку стоит повторить */
const MAX_AGE_DAYS = 30;

/**
 * Проверка клиента в реестре должников по исполнительным производствам.
 *
 * Ключ портала живёт только в переменной окружения на сервере: браузер о нём
 * не знает, и в ответ он не попадает ни при каких условиях.
 *
 * GET  — что известно по номеру из кеша, без обращения к порталу.
 * POST — проверить: свежий результат отдаём из кеша, иначе идём на портал.
 */
export async function GET(req: NextRequest) {
  try {
    await requireAuth("clients.view");
    const value = (req.nextUrl.searchParams.get("value") ?? "").replace(/\D/g, "");
    if (!isValidIdentifier(value)) throw new ApiError(400, "ИИН или БИН должен состоять из 12 цифр");

    return NextResponse.json({
      configured: isEgovConfigured(),
      check: latestDebtCheck(value),
      maxAgeDays: MAX_AGE_DAYS,
    });
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireAuth("clients.view");
    const body = await req.json();

    const value = String(body?.value ?? "").replace(/\D/g, "");
    if (!isValidIdentifier(value)) throw new ApiError(400, "ИИН или БИН должен состоять из 12 цифр");
    const kind: "iin" | "bin" = body?.kind === "bin" ? "bin" : "iin";

    if (!isEgovConfigured()) {
      throw new ApiError(503, "Проверка недоступна: не настроен ключ портала открытых данных");
    }

    // Свежую проверку не повторяем: у портала свои лимиты, а реестр меняется не по часам
    const cached = latestDebtCheck(value);
    const fresh =
      cached &&
      cached.status !== "unknown" &&
      Date.now() - new Date(cached.checkedAt).getTime() < MAX_AGE_DAYS * 86400000;
    if (fresh && !body?.force) return NextResponse.json({ check: cached, fromCache: true });

    // Имя параметра у сервиса не описано в паспорте набора, поэтому пробуем
    // привычные написания, пока не придёт разбираемый ответ
    const names = body?.param ? [String(body.param)] : kind === "bin" ? ["bin", "iin", "iinbin"] : ["iin", "iinbin", "bin"];

    let last: Awaited<ReturnType<typeof callRegistry>> | null = null;
    let parsed = null as ReturnType<typeof parseDebtResponse> | null;

    for (const name of names) {
      try {
        last = await callRegistry({ [name]: value });
      } catch (err) {
        // Таймаут или сеть — портал недоступен, это не повод ронять страницу
        throw new ApiError(503, err instanceof Error && err.name === "AbortError" ? "Портал не ответил вовремя" : "Портал недоступен");
      }
      const attempt = parseDebtResponse(last);
      if (attempt.status !== "unknown") {
        parsed = attempt;
        break;
      }
    }

    const result = parsed ?? { status: "unknown" as const, cases: 0, amount: 0, travelBan: false, items: [] };

    const check = saveDebtCheck({
      clientId: body?.clientId,
      identifier: value,
      kind,
      status: result.status,
      cases: result.cases,
      amount: result.amount,
      travelBan: result.travelBan,
      raw: last?.body,
      actorName: me.name,
    });

    // Владельцу отдаём и сырой ответ: пока формат сервиса не подтверждён,
    // без него не понять, почему проверка вернулась «непонятно»
    const debug =
      me.isOwner && body?.debug
        ? { httpStatus: last?.status, contentType: last?.contentType, url: last?.safeUrl, body: last?.body?.slice(0, 4000) }
        : undefined;

    return NextResponse.json({ check, fromCache: false, debug });
  } catch (e) {
    return apiError(e);
  }
}
