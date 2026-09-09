import { NextRequest, NextResponse } from "next/server";
import { requireAuth, apiError, required, assertNonNegativeFields } from "@/lib/auth";
import { getKit, updateKit, deleteKit } from "@/lib/repo";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth("catalog.view");
    const { id } = await params;
    const kit = getKit(id);
    if (!kit) return NextResponse.json({ error: "Комплект не найден" }, { status: 404 });
    return NextResponse.json(kit);
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
      delete patch.pricePerDay;
    }
    if (patch.name !== undefined) patch.name = required(patch.name, "название комплекта");
    assertNonNegativeFields(patch, { price: "Цена" });
    const kit = updateKit(id, patch);
    if (!kit) return NextResponse.json({ error: "Комплект не найден" }, { status: 404 });
    return NextResponse.json(kit);
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth("catalog.edit");
    const { id } = await params;
    deleteKit(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
