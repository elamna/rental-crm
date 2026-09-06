import { NextRequest, NextResponse } from "next/server";
import { requireAuth, apiError, required } from "@/lib/auth";
import { listInventoryChecks, createInventoryCheck } from "@/lib/repo";

export async function GET() {
  try {
    await requireAuth("catalog.view");
    return NextResponse.json(listInventoryChecks());
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireAuth("catalog.edit");
    const body = await req.json();
    required(body.inventoryItemId, "единицу инвентаря");
    // Кто проверял — берём из сессии, а не из тела запроса
    return NextResponse.json(createInventoryCheck({ ...body, checkedByName: me.name }), { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
