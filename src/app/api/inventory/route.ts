import { NextRequest, NextResponse } from "next/server";
import { requireAuth, apiError, required, assertNonNegativeFields } from "@/lib/auth";
import { listInventory, createInventoryItem, createInventoryItems } from "@/lib/repo";
import { jsonCompressed } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    await requireAuth("catalog.view");
    return jsonCompressed(req, listInventory());
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth("catalog.edit");
    const body = await req.json();
    body.name = required(body.name, "название инструмента");
    assertNonNegativeFields(body, { rentalPricePerDay: "Стоимость аренды", purchasePrice: "Стоимость покупки" });

    // quantity > 1 — создаём несколько одинаковых единиц, каждой свой артикул
    const quantity = Number(body.quantity ?? 1);
    if (quantity > 1) return NextResponse.json(createInventoryItems(body, quantity), { status: 201 });
    return NextResponse.json(createInventoryItem(body), { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
