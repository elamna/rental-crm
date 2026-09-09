import { NextRequest, NextResponse } from "next/server";
import { requireAuth, apiError, required } from "@/lib/auth";
import { getService, updateService, deleteService } from "@/lib/repo";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth("catalog.view");
    const { id } = await params;
    const service = getService(id);
    if (!service) return NextResponse.json({ error: "Услуга не найдена" }, { status: 404 });
    return NextResponse.json(service);
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
      delete patch.tariffs;
    }
    if (patch.name !== undefined) patch.name = required(patch.name, "название услуги");
    const service = updateService(id, patch);
    if (!service) return NextResponse.json({ error: "Услуга не найдена" }, { status: 404 });
    return NextResponse.json(service);
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth("catalog.edit");
    const { id } = await params;
    deleteService(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
