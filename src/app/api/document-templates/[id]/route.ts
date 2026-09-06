import { NextRequest, NextResponse } from "next/server";
import { requireAuth, apiError, required } from "@/lib/auth";
import { getDocumentTemplate, updateDocumentTemplate, deleteDocumentTemplate } from "@/lib/repo";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth("documents.view");
    const { id } = await params;
    const tpl = getDocumentTemplate(id);
    if (!tpl) return NextResponse.json({ error: "Шаблон не найден" }, { status: 404 });
    return NextResponse.json(tpl);
  } catch (e) {
    return apiError(e);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth("documents.edit");
    const { id } = await params;
    const patch = await req.json();
    if (patch.name !== undefined) patch.name = required(patch.name, "название шаблона");
    const tpl = updateDocumentTemplate(id, patch);
    if (!tpl) return NextResponse.json({ error: "Шаблон не найден" }, { status: 404 });
    return NextResponse.json(tpl);
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth("documents.edit");
    const { id } = await params;
    deleteDocumentTemplate(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
