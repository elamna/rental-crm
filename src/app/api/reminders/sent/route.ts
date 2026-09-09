import { NextRequest, NextResponse } from "next/server";
import { requireAuth, apiError, ApiError } from "@/lib/auth";
import { markReminderSent } from "@/lib/repo";

/** «Написал» — повод гаснет на срок молчания и остаётся в истории */
export async function POST(req: NextRequest) {
  try {
    const me = await requireAuth("rentals.edit");
    const body = await req.json();
    if (!body?.kind || !body?.targetId) throw new ApiError(400, "Не указано, о чём напоминание");

    return NextResponse.json(
      markReminderSent({
        kind: body.kind,
        targetId: body.targetId,
        phone: body.phone,
        message: body.message,
        actorName: me.name,
      })
    );
  } catch (e) {
    return apiError(e);
  }
}
