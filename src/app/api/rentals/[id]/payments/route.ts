import { NextRequest, NextResponse } from "next/server";
import { requireAuth, apiError, ApiError } from "@/lib/auth";
import { addRentalPayment, listRentalPayments } from "@/lib/repo";
import { PaymentMethod } from "@/lib/types";

const METHODS: PaymentMethod[] = ["cash", "kaspi", "company"];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth("rentals.view");
    const { id } = await params;
    return NextResponse.json(listRentalPayments(id));
  } catch (e) {
    return apiError(e);
  }
}

/** Приём оплаты: сумма и способ. Способ нужен аналитике — по нему считается касса */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth("rentals.edit");
    const { id } = await params;
    const { amount, method } = await req.json();

    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) throw new ApiError(400, "Сумма оплаты должна быть больше нуля");
    if (!METHODS.includes(method)) throw new ApiError(400, "Выберите способ оплаты");

    return NextResponse.json(addRentalPayment(id, value, method));
  } catch (e) {
    return apiError(e);
  }
}
