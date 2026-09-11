import { NextRequest, NextResponse } from "next/server";
import { requireAuth, apiError, ApiError } from "@/lib/auth";
import { branchUsage, getBranches, setBranches } from "@/lib/repo";

/**
 * Список нужен всем формам — от новой аренды до карточки инструмента.
 * С ?usage=1 добавляется, сколько записей ссылается на пункт: это показывают
 * в настройках, чтобы пункт не удаляли, не понимая последствий.
 */
export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const branches = getBranches();
    if (req.nextUrl.searchParams.get("usage") === "1") {
      return NextResponse.json(branches.map((name) => ({ name, ...branchUsage(name) })));
    }
    return NextResponse.json(branches);
  } catch (e) {
    return apiError(e);
  }
}

/** Меняет только администратор: пункт проката попадает в документы и отчёты */
export async function PUT(req: NextRequest) {
  try {
    const me = await requireAuth("settings.view");
    if (!me.isAdmin) throw new ApiError(403, "Пункты проката меняет только администратор");
    const body = await req.json();
    return NextResponse.json(setBranches(body?.branches ?? body));
  } catch (e) {
    return apiError(e);
  }
}
