import { NextRequest, NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/auth";
import { funnelDaySummary } from "@/lib/repo";

/**
 * Сводка воронки за день. Границы суток присылает браузер: часовой пояс
 * пользователя знает только он, а в базе время лежит в UTC.
 */
export async function GET(req: NextRequest) {
  try {
    await requireAuth("leads.view");
    const p = req.nextUrl.searchParams;
    const from = p.get("from");
    const to = p.get("to");
    if (!from || !to) {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const end = new Date(start.getTime() + 86400000 - 1);
      return NextResponse.json(funnelDaySummary(start.toISOString(), end.toISOString()));
    }
    return NextResponse.json(funnelDaySummary(from, to));
  } catch (e) {
    return apiError(e);
  }
}
