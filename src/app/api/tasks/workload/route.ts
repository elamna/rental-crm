import { NextResponse } from "next/server";
import { TASKS_ENABLED, featureDisabled } from "@/lib/features";
import { requireAuth, apiError } from "@/lib/auth";
import { taskWorkload, syncAutoTasks } from "@/lib/repo";

/** Сводка по сотрудникам: чем заняты, что горит, сколько закрыли за неделю */
export async function GET() {
  if (!TASKS_ENABLED) return featureDisabled("Темп");
  try {
    await requireAuth("tasks.manage");
    syncAutoTasks();
    return NextResponse.json(taskWorkload());
  } catch (e) {
    return apiError(e);
  }
}
