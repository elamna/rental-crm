import { NextRequest, NextResponse } from "next/server";
import { requireAuth, apiError, required, assertNonNegativeFields } from "@/lib/auth";
import { getShopProduct, updateShopProduct, deleteShopProduct } from "@/lib/repo";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth("shop.view");
    const { id } = await params;
    const product = getShopProduct(id);
    if (!product) return NextResponse.json({ error: "Товар не найден" }, { status: 404 });
    return NextResponse.json(product);
  } catch (e) {
    return apiError(e);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireAuth("shop.edit");
    const { id } = await params;
    const patch = await req.json();
    // Прейскурант меняет только администратор: цены — общая для всей системы
    // величина, по ним считается выручка, скидки и рентабельность.
    // Проверка серверная, поэтому обойти её запросом мимо интерфейса нельзя
    if (!me.isAdmin) {
      delete patch.price;
      delete patch.purchaseCost;
    }
    if (patch.name !== undefined) patch.name = required(patch.name, "название товара");
    assertNonNegativeFields(patch, { price: "Цена", purchaseCost: "Себестоимость", qty: "Количество" });
    const product = updateShopProduct(id, patch);
    if (!product) return NextResponse.json({ error: "Товар не найден" }, { status: 404 });
    return NextResponse.json(product);
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth("shop.edit");
    const { id } = await params;
    deleteShopProduct(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
