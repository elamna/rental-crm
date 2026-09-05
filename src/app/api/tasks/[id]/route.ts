import { NextRequest, NextResponse } from "next/server";
import { requireAuth, hasPermission, ApiError } from "@/lib/auth";
import { getTask, updateTask, deleteTask, canSeeTask } from "@/lib/repo";
import { Task } from "@/lib/types";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const me = await requireAuth("tasks.view");
    const canManageAll = hasPermission(me, "tasks.manage");

    const task = getTask(id);
    if (!task) return NextResponse.json({ error: "Задача не найдена" }, { status: 404 });
    if (!canSeeTask(task, me.id, canManageAll)) throw new ApiError(403, "Нет доступа");

    const body = (await req.json()) as Partial<Task>;

    // Исполнитель двигает только статус своей задачи. Сроки, вес, исполнителя
    // и список зрителей меняет лишь тот, у кого есть tasks.manage
    const patch: Partial<Task> = canManageAll
      ? body
      : task.assigneeId === me.id
        ? { status: body.status }
        : {};

    if (Object.keys(patch).length === 0) throw new ApiError(403, "Можно менять только статус своей задачи");

    return NextResponse.json(updateTask(id, patch));
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireAuth("tasks.manage");
    deleteTask(id);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
