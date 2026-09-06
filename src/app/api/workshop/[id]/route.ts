import { NextRequest, NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/auth";
import { getWorkshopTicket, updateWorkshopTicket, deleteWorkshopTicket } from "@/lib/repo";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth("workshop.view");
    const { id } = await params;
    const ticket = getWorkshopTicket(id);
    if (!ticket) return NextResponse.json({ error: "Заявка не найдена" }, { status: 404 });
    return NextResponse.json(ticket);
  } catch (e) {
    return apiError(e);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth("workshop.edit");
    const { id } = await params;
    const ticket = updateWorkshopTicket(id, await req.json());
    if (!ticket) return NextResponse.json({ error: "Заявка не найдена" }, { status: 404 });
    return NextResponse.json(ticket);
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth("workshop.edit");
    const { id } = await params;
    deleteWorkshopTicket(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
