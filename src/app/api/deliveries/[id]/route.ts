import { NextRequest, NextResponse } from "next/server";
import { requireAuth, apiError, assertNonNegativeFields } from "@/lib/auth";
import { getDelivery, updateDelivery, deleteDelivery } from "@/lib/repo";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth("delivery.view");
    const { id } = await params;
    const delivery = getDelivery(id);
    if (!delivery) return NextResponse.json({ error: "Доставка не найдена" }, { status: 404 });
    return NextResponse.json(delivery);
  } catch (e) {
    return apiError(e);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireAuth("delivery.edit");
    const { id } = await params;
    const patch = await req.json();
    assertNonNegativeFields(patch, { price: "Цена" });

    // Взял в работу и курьер не выбран — назначаем себя: обычно везёт тот, кто нажал
    if (patch.status === "in_progress" && !patch.courierId) {
      const current = getDelivery(id);
      if (current && !current.courierId) patch.courierId = me.id;
    }

    const delivery = updateDelivery(id, patch);
    if (!delivery) return NextResponse.json({ error: "Доставка не найдена" }, { status: 404 });
    return NextResponse.json(delivery);
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth("delivery.edit");
    const { id } = await params;
    deleteDelivery(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
