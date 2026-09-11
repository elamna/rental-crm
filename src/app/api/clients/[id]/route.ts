import { NextRequest, NextResponse } from "next/server";
import { requireAuth, apiError, required, assertNonNegativeFields, assertTextLimits, TEXT_LIMITS } from "@/lib/auth";
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
    assertTextLimits(patch, {
      name: [TEXT_LIMITS.short, "Имя"],
      phone: [TEXT_LIMITS.short, "Телефон"],
      email: [TEXT_LIMITS.short, "Email"],
      iin: [TEXT_LIMITS.short, "ИИН"],
      bin: [TEXT_LIMITS.short, "БИН"],
      documentNumber: [TEXT_LIMITS.short, "Номер документа"],
      documentIssuedBy: [TEXT_LIMITS.medium, "Кем выдан"],
      legalAddress: [TEXT_LIMITS.medium, "Адрес"],
      companyDirector: [TEXT_LIMITS.short, "Руководитель"],
      bank: [TEXT_LIMITS.medium, "Банк"],
      bankAccount: [TEXT_LIMITS.short, "Счёт"],
      bik: [TEXT_LIMITS.short, "БИК"],
      notes: [TEXT_LIMITS.long, "Заметки"],
      blacklistReason: [TEXT_LIMITS.medium, "Причина блокировки"],
    });
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
