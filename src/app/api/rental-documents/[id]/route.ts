import { NextRequest, NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/auth";
import { db } from "@/lib/db";
import { deleteRentalDocument } from "@/lib/repo";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth("rentals.view");
    const { id } = await params;
    const row = db.prepare(`SELECT * FROM rental_documents WHERE id = ?`).get(id) as
      | { id: string; rental_id: string; template_id: string | null; name: string; body: string; created_at: string }
      | undefined;
    if (!row) return NextResponse.json({ error: "Документ не найден" }, { status: 404 });
    return NextResponse.json({
      id: row.id,
      rentalId: row.rental_id,
      templateId: row.template_id,
      name: row.name,
      body: row.body,
      createdAt: row.created_at,
    });
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth("documents.edit");
    const { id } = await params;
    deleteRentalDocument(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
