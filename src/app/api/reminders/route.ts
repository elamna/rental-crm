import { NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/auth";
import { listReminders } from "@/lib/repo";

/** Кому сегодня написать: возвраты, просрочки, долги, забытые заявки, некомплект */
export async function GET() {
  try {
    await requireAuth("rentals.view");
    return NextResponse.json(listReminders());
  } catch (e) {
    return apiError(e);
  }
}
