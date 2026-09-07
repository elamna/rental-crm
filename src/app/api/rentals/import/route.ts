import { NextRequest, NextResponse } from "next/server";
import { requireAuth, apiError, ApiError } from "@/lib/auth";
import { importRentals } from "@/lib/repo";

/** Импорт истории аренд из выгрузки. Как каталог и клиенты — только главный администратор */
export async function POST(req: NextRequest) {
  try {
    const me = await requireAuth("rentals.edit");
    if (!me.isOwner) throw new ApiError(403, "Импорт доступен только главному администратору");

    const rows = await req.json();
    if (!Array.isArray(rows)) throw new ApiError(400, "Ожидается список аренд");
    if (rows.length > 20000) throw new ApiError(400, "За раз можно импортировать не больше 20 000 аренд");

    return NextResponse.json(importRentals(rows));
  } catch (e) {
    return apiError(e);
  }
}
