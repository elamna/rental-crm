import { NextRequest, NextResponse } from "next/server";
import { requireAuth, apiError, required, assertNonNegativeFields } from "@/lib/auth";
import { getClient, updateClient, deleteClient } from "@/lib/repo";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth("clients.view");
    const { id } = await params;
    const client = getClient(id);
    if (!client) return NextResponse.json({ error: "Клиент не найден" }, { status: 404 });
    return NextResponse.json(client);
  } catch (e) {
    return apiError(e);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth("clients.edit");
    const { id } = await params;
    const patch = await req.json();
    if (patch.name !== undefined) patch.name = required(patch.name, "имя клиента");
    assertNonNegativeFields(patch, { discount: "Скидка" });
    const client = updateClient(id, patch);
    if (!client) return NextResponse.json({ error: "Клиент не найден" }, { status: 404 });
    return NextResponse.json(client);
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth("clients.edit");
    const { id } = await params;
    deleteClient(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
