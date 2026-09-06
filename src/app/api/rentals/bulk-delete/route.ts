import { NextRequest, NextResponse } from "next/server";
import { requireAuth, apiError, ApiError } from "@/lib/auth";
import { deleteRentals } from "@/lib/repo";

/** Массовое удаление аренд. POST, а не DELETE: тело запроса у DELETE поддерживают не все прокси */
export async function POST(req: NextRequest) {
  try {
    await requireAuth("rentals.edit");
    const { ids } = await req.json();
    if (!Array.isArray(ids) || ids.length === 0) throw new ApiError(400, "Не выбрано ни одной аренды");
    if (ids.length > 500) throw new ApiError(400, "За раз можно удалить не больше 500 аренд");
    return NextResponse.json(deleteRentals(ids));
  } catch (e) {
    return apiError(e);
  }
}
