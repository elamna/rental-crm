import { NextRequest, NextResponse } from "next/server";
import { requireAuth, apiError, ApiError } from "@/lib/auth";
import { importInventoryItems } from "@/lib/repo";

/** Импорт каталога из выгрузки. Как и клиенты — только главный администратор */
export async function POST(req: NextRequest) {
  try {
    const me = await requireAuth("catalog.edit");
    if (!me.isOwner) throw new ApiError(403, "Импорт доступен только главному администратору");

    const rows = await req.json();
    if (!Array.isArray(rows)) throw new ApiError(400, "Ожидается список позиций каталога");
    if (rows.length > 20000) throw new ApiError(400, "За раз можно импортировать не больше 20 000 строк");

    // Одна строка может развернуться в десятки единиц — ограничиваем и это
    const units = rows.reduce((sum: number, r: { quantity?: number }) => sum + Math.max(1, Number(r?.quantity) || 1), 0);
    if (units > 50000) throw new ApiError(400, "Слишком много единиц в файле: больше 50 000 за раз не импортируем");

    return NextResponse.json(importInventoryItems(rows));
  } catch (e) {
    return apiError(e);
  }
}
