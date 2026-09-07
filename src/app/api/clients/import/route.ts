import { NextRequest, NextResponse } from "next/server";
import { requireAuth, apiError, ApiError } from "@/lib/auth";
import { importClients } from "@/lib/repo";

/** Импорт базы клиентов. Операция разовая и необратимая, поэтому только владелец системы */
export async function POST(req: NextRequest) {
  try {
    const me = await requireAuth("clients.edit");
    if (!me.isOwner) throw new ApiError(403, "Импорт доступен только главному администратору");

    const rows = await req.json();
    if (!Array.isArray(rows)) throw new ApiError(400, "Ожидается список клиентов");
    if (rows.length > 50000) throw new ApiError(400, "За раз можно импортировать не больше 50 000 строк");

    return NextResponse.json(importClients(rows));
  } catch (e) {
    return apiError(e);
  }
}
