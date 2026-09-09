import { NextRequest, NextResponse } from "next/server";
import { requireAuth, apiError, ApiError } from "@/lib/auth";
import { getReminderTemplates, saveReminderTemplates } from "@/lib/repo";

export async function GET() {
  try {
    await requireAuth("rentals.view");
    return NextResponse.json(getReminderTemplates());
  } catch (e) {
    return apiError(e);
  }
}

/** Тексты правит администратор: это лицо компании перед клиентом */
export async function PUT(req: NextRequest) {
  try {
    const me = await requireAuth("rentals.edit");
    if (!me.isAdmin) throw new ApiError(403, "Менять шаблоны может только администратор");
    return NextResponse.json(saveReminderTemplates(await req.json()));
  } catch (e) {
    return apiError(e);
  }
}
