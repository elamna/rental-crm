import { NextRequest, NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/auth";
import { resolveShortage } from "@/lib/repo";

/** Закрыть вопрос: деталь вернули или клиент за неё заплатил */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireAuth("rentals.edit");
    const { id } = await params;
    const { resolved } = await req.json();

    const shortage = resolveShortage(id, !!resolved, me.name);
    if (!shortage) return NextResponse.json({ error: "Запись не найдена" }, { status: 404 });
    return NextResponse.json(shortage);
  } catch (e) {
    return apiError(e);
  }
}
