import { NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/auth";
import { dataPulse } from "@/lib/repo";

/**
 * Отпечаток состояния базы: изменилось ли что-нибудь с прошлого раза.
 *
 * Нужен, чтобы вкладка сама подхватывала работу других менеджеров. Тянуть ради
 * этого весь список аренд каждые полминуты нельзя — на телефоне это мегабайты
 * трафика; вместо этого раз в полминуты приходит короткая строка, и только если
 * она изменилась, данные перезагружаются целиком.
 */
export async function GET() {
  try {
    await requireAuth();
    return NextResponse.json({ pulse: dataPulse() }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return apiError(e);
  }
}
