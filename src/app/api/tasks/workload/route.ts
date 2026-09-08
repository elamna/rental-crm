import { NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/auth";
import { taskWorkload, syncAutoTasks } from "@/lib/repo";

/** Сводка по сотрудникам: чем заняты, что горит, сколько закрыли за неделю */
export async function GET() {
  try {
    await requireAuth("tasks.manage");
    syncAutoTasks();
    return NextResponse.json(taskWorkload());
  } catch (e) {
    return apiError(e);
  }
}
