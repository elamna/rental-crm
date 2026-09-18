import { NextRequest, NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/auth";
import { paymentsLedger } from "@/lib/repo";
import { resolvePeriod } from "@/lib/period";
import { parseClientTypeFilter } from "@/lib/client-type";

/** Кто за период заплатил, а кто остался должен — поимённо */
export async function GET(req: NextRequest) {
  try {
    await requireAuth("analytics.view");
    const { from, to } = resolvePeriod(req.nextUrl.searchParams);
    return NextResponse.json(paymentsLedger(from, to, parseClientTypeFilter(req.nextUrl.searchParams.get("clientType"))));
  } catch (e) {
    return apiError(e);
  }
}
