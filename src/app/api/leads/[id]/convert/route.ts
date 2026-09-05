import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getLead, findClientByPhone, createClient } from "@/lib/repo";

/**
 * Заявка → аренда. Здесь только клиент: находим по телефону или заводим нового,
 * а саму аренду менеджер собирает в обычной форме — там выбор инструмента,
 * сроки, залог и оплата. Дублировать эту логику ради одной кнопки незачем.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireAuth("rentals.edit");

    const lead = getLead(id);
    if (!lead) return NextResponse.json({ error: "Заявка не найдена" }, { status: 404 });

    const name = (lead.clientName ?? "").trim();
    const phone = (lead.phone ?? "").trim();
    if (!name && !phone) {
      return NextResponse.json({ error: "В заявке не указаны имя и телефон клиента" }, { status: 400 });
    }

    const existing = phone ? findClientByPhone(phone) : null;
    if (existing) return NextResponse.json({ clientId: existing.id, created: false });

    const client = createClient({
      name: name || `Клиент по заявке №${lead.number}`,
      phone,
      type: "individual",
      acquisitionChannel: lead.source,
    });
    return NextResponse.json({ clientId: client.id, created: true });
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
