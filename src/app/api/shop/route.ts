import { NextRequest, NextResponse } from "next/server";
import { requireAuth, apiError, required, assertNonNegativeFields, hasAnyPermission, ApiError } from "@/lib/auth";
import { listShopProducts, createShopProduct, shopSummary } from "@/lib/repo";

/**
 * Список товаров магазина.
 *
 * Читать его должен и тот, у кого нет доступа в сам раздел: товар продают прямо
 * в аренде («добавить из магазина»), и без этого списка окно добавления
 * оставалось пустым, а менеджер не понимал почему. Заводить и править товары
 * по-прежнему может только тот, у кого есть права на магазин.
 */
export async function GET(req: NextRequest) {
  try {
    const me = await requireAuth();
    if (!hasAnyPermission(me, ["shop.view", "rentals.edit"])) {
      throw new ApiError(403, "Нет доступа");
    }
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
