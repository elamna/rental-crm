import { NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/auth";
import { listActivity } from "@/lib/repo";

export async function GET() {
  try {
    await requireAuth();
    return NextResponse.json(listActivity());
  } catch (e) {
    return apiError(e);
  }
}
