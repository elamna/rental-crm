import { NextRequest, NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/auth";
import { deliveryStats } from "@/lib/repo";

const DAYS: Record<string, number | null> = { week: 7, month: 30, quarter: 90, all: null };

export async function GET(req: NextRequest) {
  try {
    await requireAuth("delivery.view");
    const period = req.nextUrl.searchParams.get("period") ?? "month";
    const days = period in DAYS ? DAYS[period] : 30;
    const from = days === null ? null : new Date(Date.now() - days * 86400000).toISOString();
    return NextResponse.json(deliveryStats(from));
  } catch (e) {
    return apiError(e);
  }
}
