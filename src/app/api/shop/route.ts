import { NextRequest, NextResponse } from "next/server";
import { requireAuth, apiError, required, assertNonNegativeFields } from "@/lib/auth";
import { listShopProducts, createShopProduct, shopSummary } from "@/lib/repo";

export async function GET(req: NextRequest) {
  try {
    await requireAuth("shop.view");
    const search = req.nextUrl.searchParams.get("q") ?? undefined;
    return NextResponse.json({ products: listShopProducts(search), summary: shopSummary() });
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth("shop.edit");
    const body = await req.json();
    body.name = required(body.name, "название товара");
    assertNonNegativeFields(body, { price: "Цена", purchaseCost: "Себестоимость", qty: "Количество" });
    return NextResponse.json(createShopProduct(body), { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
