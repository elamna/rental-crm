import { NextRequest, NextResponse } from "next/server";
import { requireAuth, apiError, required, assertNonNegativeFields } from "@/lib/auth";
import { getInventoryItem, updateInventoryItem, deleteInventoryItem } from "@/lib/repo";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth("catalog.view");
    const { id } = await params;
    const item = getInventoryItem(id);
    if (!item) return NextResponse.json({ error: "Инструмент не найден" }, { status: 404 });
    return NextResponse.json(item);
  } catch (e) {
    return apiError(e);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireAuth("catalog.edit");
    const { id } = await params;
    const patch = await req.json();
    // Прейскурант меняет только администратор: цены — общая для всей системы
    // величина, по ним считается выручка, скидки и рентабельность.
    // Проверка серверная, поэтому обойти её запросом мимо интерфейса нельзя
    if (!me.isAdmin) {
      delete patch.rentalPricePerDay;
      delete patch.purchasePrice;
    }
    if (patch.name !== undefined) patch.name = required(patch.name, "название инструмента");
    assertNonNegativeFields(patch, { rentalPricePerDay: "Стоимость аренды", purchasePrice: "Стоимость покупки" });
    const item = updateInventoryItem(id, patch);
    if (!item) return NextResponse.json({ error: "Инструмент не найден" }, { status: 404 });
    return NextResponse.json(item);
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth("catalog.edit");
    const { id } = await params;
    deleteInventoryItem(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
