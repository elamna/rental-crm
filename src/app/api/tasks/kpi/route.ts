import { NextRequest, NextResponse } from "next/server";
import { requireAuth, hasPermission } from "@/lib/auth";
import { taskKpi } from "@/lib/repo";

const DAYS: Record<string, number | null> = { week: 7, month: 30, quarter: 90, all: null };

export async function GET(req: NextRequest) {
  try {
    const me = await requireAuth("tasks.view");
    const canManageAll = hasPermission(me, "tasks.manage");

    const period = req.nextUrl.searchParams.get("period") ?? "month";
    const days = period in DAYS ? DAYS[period] : 30;
    const from = days === null ? null : new Date(Date.now() - days * 86400000).toISOString();

    // Без tasks.manage сотрудник видит только собственный показатель
    return NextResponse.json(taskKpi(from, canManageAll ? undefined : me.id));
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
