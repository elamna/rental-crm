import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { listRentalEvents, revertRentalEvent } from "@/lib/repo";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireAuth("rentals.view");
    return NextResponse.json(listRentalEvents(id));
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}

/** Откат ошибочного действия: { eventId } */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const me = await requireAuth("rentals.edit");
    const { eventId } = await req.json();
    if (!eventId) return NextResponse.json({ error: "Не указано событие" }, { status: 400 });

    const rental = revertRentalEvent(eventId, me.name);
    if (!rental) return NextResponse.json({ error: "Это действие уже отменено или его нельзя откатить" }, { status: 400 });

    return NextResponse.json({ rental, events: listRentalEvents(id) });
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
