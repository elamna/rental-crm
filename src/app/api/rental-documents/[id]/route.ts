import { NextRequest, NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/auth";
import { deleteRentalDocument, getRentalDocument, setDocumentSigned } from "@/lib/repo";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth("rentals.view");
    const { id } = await params;
    const doc = getRentalDocument(id);
    if (!doc) return NextResponse.json({ error: "Документ не найден" }, { status: 404 });
    return NextResponse.json(doc);
  } catch (e) {
    return apiError(e);
  }
}

/** Отметка о подписании: её ставят сразу после печати, ответом на вопрос «подписан?» */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireAuth("documents.edit");
    const { id } = await params;
    const { signed } = await req.json();

    const doc = setDocumentSigned(id, !!signed, me.name);
    if (!doc) return NextResponse.json({ error: "Документ не найден" }, { status: 404 });
    return NextResponse.json(doc);
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
