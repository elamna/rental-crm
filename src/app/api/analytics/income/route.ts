import { NextRequest, NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/auth";
import { incomeBreakdown } from "@/lib/repo";
import { resolvePeriod } from "@/lib/period";
import { parseClientTypeFilter } from "@/lib/client-type";

/** Поступления за период: чем платили (Kaspi, наличные, компании) и за что */
export async function GET(req: NextRequest) {
  try {
    await requireAuth("analytics.view");
    const { from, to } = resolvePeriod(req.nextUrl.searchParams);
    return NextResponse.json(incomeBreakdown(from, to, parseClientTypeFilter(req.nextUrl.searchParams.get("clientType"))));
  } catch (e) {
    return apiError(e);
  }
}
