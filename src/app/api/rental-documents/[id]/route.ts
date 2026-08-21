import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { deleteRentalDocument } from "@/lib/repo";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = db.prepare(`SELECT * FROM rental_documents WHERE id = ?`).get(id) as {
    id: string; rental_id: string; template_id: string | null; name: string; body: string; created_at: string;
  } | undefined;
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ id: row.id, rentalId: row.rental_id, templateId: row.template_id, name: row.name, body: row.body, createdAt: row.created_at });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  deleteRentalDocument(id);
  return NextResponse.json({ ok: true });
}
