import { NextRequest, NextResponse } from "next/server";
import { requireAuth, apiError, ApiError, assertNonNegativeFields } from "@/lib/auth";
import { listRentals, createRental } from "@/lib/repo";
import { PaymentMethod, Rental } from "@/lib/types";
import { jsonCompressed } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    await requireAuth("rentals.view");
    // Список большой — отдаём сжатым, иначе на телефоне он едет мегабайтами
    return jsonCompressed(req, listRentals());
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireAuth("rentals.edit");
    const body = (await req.json()) as Rental & { payments?: { amount: number; method: PaymentMethod }[] };
    if (!body?.client?.id) throw new ApiError(400, "Выберите клиента");
    if (!body.startAt || !body.endAt) throw new ApiError(400, "Укажите даты аренды");
    assertNonNegativeFields(body as unknown as Record<string, unknown>, { total: "Сумма", paid: "Оплачено" });
    const methods: PaymentMethod[] = ["cash", "kaspi", "company"];
    const payments = (body.payments ?? []).filter((p) => Number(p?.amount) > 0 && methods.includes(p?.method));

    return NextResponse.json(createRental(body, payments, me.name), { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
