/**
 * Портал открытых данных: реестр должников по исполнительным производствам.
 *
 * Сервис Минюста РК, точка `data.egov.kz/proxy/reestr_dolzh_po_isp_pr`. Ключ
 * лежит только в переменной окружения на сервере и в браузер не попадает —
 * весь обмен идёт через наш эндпоинт `/api/debt-check`.
 *
 * Сам сайт реестра (aisoip.adilet.gov.kz) закрыт капчей и для машинных запросов
 * не предназначен, поэтому берём данные официальным путём.
 */

import { DebtCase } from "./types";

const SERVICE_URL = "https://data.egov.kz/proxy/reestr_dolzh_po_isp_pr";

/** Ответ портала как есть — по нему разбираем результат и его же храним */
export interface RegistryResponse {
  status: number;
  contentType: string;
  body: string;
  /** Адрес запроса без ключа: его можно показывать и писать в лог */
  safeUrl: string;
}

export function isEgovConfigured() {
  return !!process.env.EGOV_API_KEY;
}

/** ИИН и БИН — ровно 12 цифр. Проверяем до запроса, чтобы не жечь лимит портала */
export function isValidIdentifier(value: string) {
  return /^\d{12}$/.test(value.replace(/\D/g, ""));
}

/**
 * Произвольная точка портала с ключом. Нужна, чтобы проверять не только прокси
 * реестра (он сломан на стороне портала), но и обычное API наборов данных:
 * возможно, тот же реестр доступен как набор, а не как сервис.
 */
export async function callEgov(path: string, params: Record<string, string> = {}, timeoutMs = 15_000): Promise<RegistryResponse> {
  const apiKey = process.env.EGOV_API_KEY;
  if (!apiKey) throw new Error("EGOV_API_KEY не задан");

  const url = new URL(path, "https://data.egov.kz");
  url.searchParams.set("apiKey", apiKey);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const safe = new URL(url.toString());
  safe.searchParams.set("apiKey", "***");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
    return {
      status: res.status,
      contentType: res.headers.get("content-type") ?? "",
      body: await res.text(),
      safeUrl: safe.toString(),
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function callRegistry(params: Record<string, string>, timeoutMs = 12_000): Promise<RegistryResponse> {
  const apiKey = process.env.EGOV_API_KEY;
  if (!apiKey) throw new Error("EGOV_API_KEY не задан");

  const url = new URL(SERVICE_URL);
  url.searchParams.set("apiKey", apiKey);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const safe = new URL(url.toString());
  safe.searchParams.set("apiKey", "***");

  // Госсервис отвечает не всегда: без таймаута запрос повиснет и утащит за собой
  // страницу оформления аренды
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
    return {
      status: res.status,
      contentType: res.headers.get("content-type") ?? "",
      body: await res.text(),
      safeUrl: safe.toString(),
    };
  } finally {
    clearTimeout(timer);
  }
}

export interface ParsedDebt {
  /** clean — в реестре нет, debtor — есть, unknown — портал ответил непонятно */
  status: "clean" | "debtor" | "unknown";
  cases: number;
  amount: number;
  /** Ограничение на выезд из РК — отдельная строка того же реестра */
  travelBan: boolean;
  items: Record<string, unknown>[];
  /** Те же записи, разложенные по понятным полям — их показывает интерфейс */
  records: DebtCase[];
}

/** Названия полей у сервиса заранее не известны — ищем по смыслу */
const FIELD_HINTS: Record<keyof DebtCase, RegExp> = {
  debtor: /(debtor|dolzh|борыш|должник|fio|name)/i,
  startedAt: /(date|data|dat_|нача|возбуж|reg)/i,
  officer: /(ispoln|executor|officer|sudeb|чси|гси)/i,
  issuedBy: /(organ|issued|vydal|court|sud)/i,
  claimant: /(vzysk|claimant|creditor|взыск)/i,
  amount: /(sum|summa|amount|debt|dolg)/i,
  travelBan: /(vyezd|viezd|travel|restrict|ogranich|выезд|запрет)/i,
  travelBanFrom: /(ban_?date|zapret_?date|дата_?запрета)/i,
};

function toDebtCase(item: Record<string, unknown>): DebtCase {
  const result: DebtCase = {};
  for (const [field, pattern] of Object.entries(FIELD_HINTS) as [keyof DebtCase, RegExp][]) {
    const hit = Object.entries(item).find(([key, value]) => pattern.test(key) && value !== null && value !== "");
    if (!hit) continue;
    const value = hit[1];
    if (field === "amount") {
      const num = typeof value === "number" ? value : parseFloat(String(value).replace(/\s/g, "").replace(",", "."));
      if (Number.isFinite(num)) result.amount = Math.round(num);
    } else if (field === "travelBan") {
      result.travelBan = isTruthy(value);
    } else {
      result[field] = String(value) as never;
    }
  }
  return result;
}

const AMOUNT_KEYS = /(sum|summa|amount|debt|dolg|zadolzh|қарыз|борыш)/i;
const BAN_KEYS = /(vyezd|viezd|travel|restrict|ogranich|shygu|шығу|выезд)/i;

/**
 * Разбор ответа портала.
 *
 * Формат сервиса нигде не описан, а у соседних наборов он разный: то массив,
 * то объект с полем `data`. Поэтому разбираем по смыслу, а сырой ответ всегда
 * складываем в базу — если структура окажется другой, разберём по факту,
 * не потеряв ни одной проверки.
 */
export function parseDebtResponse(res: RegistryResponse): ParsedDebt {
  const empty: ParsedDebt = { status: "unknown", cases: 0, amount: 0, travelBan: false, items: [], records: [] };
  if (res.status !== 200) return empty;

  let json: unknown;
  try {
    json = JSON.parse(res.body);
  } catch {
    return empty;
  }

  const items = extractItems(json);
  if (items === null) return empty;
  if (items.length === 0) return { status: "clean", cases: 0, amount: 0, travelBan: false, items: [], records: [] };

  let amount = 0;
  let travelBan = false;
  for (const item of items) {
    for (const [key, value] of Object.entries(item)) {
      if (AMOUNT_KEYS.test(key)) {
        const num = typeof value === "number" ? value : parseFloat(String(value).replace(/\s/g, "").replace(",", "."));
        if (Number.isFinite(num)) amount += num;
      }
      if (BAN_KEYS.test(key) && isTruthy(value)) travelBan = true;
    }
  }

  return { status: "debtor", cases: items.length, amount: Math.round(amount), travelBan, items, records: items.map(toDebtCase) };
}

function isTruthy(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;
  const text = String(value ?? "").trim().toLowerCase();
  return text === "true" || text === "1" || text === "да" || text === "иә";
}

/** Достаёт список записей из ответа любой из привычных для портала форм */
function extractItems(json: unknown): Record<string, unknown>[] | null {
  if (Array.isArray(json)) return json as Record<string, unknown>[];
  if (!json || typeof json !== "object") return null;

  const obj = json as Record<string, unknown>;
  // Портал иногда сообщает об ошибке двумястами — распознаём это по полям
  if ("code" in obj && "message" in obj && !("data" in obj)) return null;

  for (const key of ["data", "items", "list", "content", "result", "rows", "response"]) {
    const value = obj[key];
    if (Array.isArray(value)) return value as Record<string, unknown>[];
    if (value && typeof value === "object") {
      const nested = extractItems(value);
      if (nested) return nested;
    }
  }
  // Одиночная запись тоже валидный ответ
  return Object.keys(obj).length > 0 ? [obj] : [];
}
