import { NextRequest, NextResponse } from "next/server";
import { requireAuth, apiError, ApiError } from "@/lib/auth";
import { deleteInventoryItems } from "@/lib/repo";

/** Массовое удаление позиций каталога — как аренды и клиенты, только администратору */
export async function POST(req: NextRequest) {
  try {
    const me = await requireAuth("catalog.edit");
    if (!me.isAdmin) throw new ApiError(403, "Массовое удаление доступно только администратору");

    const { ids } = await req.json();
    if (!Array.isArray(ids) || ids.length === 0) throw new ApiError(400, "Не выбрано ни одной позиции");

    return NextResponse.json(deleteInventoryItems(ids));
  } catch (e) {
    return apiError(e);
  }
}
