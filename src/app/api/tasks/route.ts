import { NextRequest, NextResponse } from "next/server";
import { requireAuth, hasPermission } from "@/lib/auth";
import { listTasks, createTask } from "@/lib/repo";

export async function GET() {
  try {
    const me = await requireAuth("tasks.view");
    // Полный список видит только тот, кому открыты все задачи
    const canManageAll = hasPermission(me, "tasks.manage");
    return NextResponse.json(listTasks(me.id, canManageAll));
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireAuth("tasks.manage");
    const body = await req.json();
    if (!body.title || !String(body.title).trim()) {
      return NextResponse.json({ error: "Укажите название задачи" }, { status: 400 });
    }
    return NextResponse.json(createTask(body, me.id), { status: 201 });
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
