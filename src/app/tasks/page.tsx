"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { Task, TaskStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";
import { TaskBoard } from "@/components/tasks/task-board";
import { TaskKpi } from "@/components/tasks/task-kpi";
import { TaskModal, type Assignee } from "@/components/tasks/task-modal";

type Tab = "board" | "kpi";

export default function TasksPage() {
  const { user, can } = useAuth();
  const canManageAll = can("tasks.manage");

  const [tab, setTab] = useState<Tab>("board");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);
  const [onlyMine, setOnlyMine] = useState(false);

  // Задачи намеренно не лежат в общем сторе: он грузится на каждой странице,
  // а «Темп» нужен не всем. Здесь свой запрос и свой кэш.
  const loadTasks = useCallback(async () => {
    const res = await fetch("/api/tasks");
    if (res.ok) setTasks(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    if (!canManageAll) return;
    fetch("/api/staff")
      .then((r) => (r.ok ? r.json() : []))
      .then(setAssignees)
      .catch(() => setAssignees([]));
  }, [canManageAll]);

  const visible = useMemo(
    () => (onlyMine && user ? tasks.filter((t) => t.assigneeId === user.id) : tasks),
    [tasks, onlyMine, user]
  );

  /** Перенос карточки: сразу двигаем в интерфейсе, при ошибке откатываем */
  async function move(task: Task, status: TaskStatus) {
    const prev = tasks;
    setTasks((list) => list.map((t) => (t.id === task.id ? { ...t, status } : t)));
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      setTasks(prev);
      alert("Не удалось изменить статус задачи");
      return;
    }
    const updated: Task = await res.json();
    setTasks((list) => list.map((t) => (t.id === updated.id ? updated : t)));
  }

  if (!can("tasks.view")) {
    return (
      <div className="grid h-full place-items-center p-6 text-center text-[13.5px] text-[var(--color-text-muted)]">
        Нет доступа к разделу «Темп»
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]/70 px-4 py-3 backdrop-blur sm:px-6 sm:py-4">
        <div className="min-w-0">
          <h1 className="font-display text-[20px] font-bold">Темп</h1>
          <p className="text-[13px] text-[var(--color-text-muted)]">
            {canManageAll ? "Задачи сотрудников и KPI по выполнению" : "Ваши задачи и личный KPI"}
          </p>
        </div>
        {canManageAll && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 whitespace-nowrap rounded-[10px] bg-[var(--color-primary)] px-4 py-2 text-[13px] font-semibold text-[var(--color-on-primary)] shadow-[var(--shadow-primary)] transition hover:bg-[var(--color-primary-hover)]"
          >
            <Plus className="h-3.5 w-3.5" /> Новая задача
          </button>
        )}
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-bg)] p-1">
            {(
              [
                { key: "board", label: "Доска" },
                { key: "kpi", label: "KPI" },
              ] as { key: Tab; label: string }[]
            ).map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "rounded-[8px] px-3.5 py-1.5 text-[12.5px] font-semibold transition",
                  tab === t.key ? "bg-[var(--color-surface)] text-[var(--color-primary)] shadow-sm" : "text-[var(--color-text-muted)]"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "board" && canManageAll && (
            <label className="flex cursor-pointer select-none items-center gap-2 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[12.5px] font-medium text-[var(--color-text-muted)]">
              <input
                type="checkbox"
                checked={onlyMine}
                onChange={(e) => setOnlyMine(e.target.checked)}
                className="h-4 w-4 accent-[var(--color-primary)]"
              />
              Только мои
            </label>
          )}
        </div>

        {tab === "board" ? (
          loading ? (
            <p className="py-10 text-center text-[13px] text-[var(--color-text-muted)]">Загрузка…</p>
          ) : tasks.length === 0 ? (
            <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] py-16 text-center card-shadow">
              <p className="text-[13.5px] text-[var(--color-text-muted)]">
                {canManageAll ? "Задач пока нет — поставьте первую" : "Вам пока не поставили задач"}
              </p>
            </div>
          ) : (
            <TaskBoard
              tasks={visible}
              currentUserId={user?.id ?? ""}
              canManageAll={canManageAll}
              onOpen={(t) => canManageAll && setEditing(t)}
              onMove={move}
            />
          )
        ) : (
          <TaskKpi />
        )}
      </div>

      {creating && <TaskModal assignees={assignees} onClose={() => setCreating(false)} onSaved={loadTasks} />}
      {editing && <TaskModal task={editing} assignees={assignees} onClose={() => setEditing(null)} onSaved={loadTasks} />}
    </div>
  );
}
