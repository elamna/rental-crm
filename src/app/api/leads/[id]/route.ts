import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { updateLead, deleteLead } from "@/lib/repo";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireAuth("leads.edit");
    const lead = updateLead(id, await req.json());
    if (!lead) return NextResponse.json({ error: "Заявка не найдена" }, { status: 404 });
    return NextResponse.json(lead);
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireAuth("leads.edit");
    deleteLead(id);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
