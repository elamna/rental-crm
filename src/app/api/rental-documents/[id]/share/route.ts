import { NextRequest, NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/auth";
import { shareRentalDocument, revokeRentalDocumentShare } from "@/lib/repo";

/**
 * Ссылка на документ для клиента.
 *
 * POST создаёт её (или возвращает уже созданную), DELETE отзывает — тогда
 * отправленная ранее ссылка перестаёт открываться. Права те же, что и на
 * работу с документами аренды.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth("documents.create");
    const { id } = await params;
    const doc = shareRentalDocument(id);
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
    const doc = revokeRentalDocumentShare(id);
    if (!doc) return NextResponse.json({ error: "Документ не найден" }, { status: 404 });
    return NextResponse.json(doc);
  } catch (e) {
    return apiError(e);
  }
}
