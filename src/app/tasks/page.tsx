"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { Task, TaskStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Plus, Search, X } from "lucide-react";
import { TaskBoard } from "@/components/tasks/task-board";
import { TaskKpi } from "@/components/tasks/task-kpi";
import { MyWork } from "@/components/tasks/my-work";
import { TaskPeople } from "@/components/tasks/task-people";
import { TaskModal, type Assignee } from "@/components/tasks/task-modal";

type Tab = "mine" | "board" | "people" | "kpi";

export default function TasksPage() {
  const { user, can } = useAuth();
  const canManageAll = can("tasks.manage");

  // Сотрудник открывает раздел ради своих задач, руководитель — ради общей картины.
  // Поэтому стартовая вкладка у них разная, а не одна доска на всех
  const [tab, setTab] = useState<Tab>("mine");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);

  // Фильтры доски: без них 20 сотрудников по 20 задач — это стена из карточек
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [hideClosed, setHideClosed] = useState(true);

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

  const boardTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => {
      if (assigneeFilter === "free" ? !!t.assigneeId : assigneeFilter && t.assigneeId !== assigneeFilter) return false;
      if (hideClosed && (t.status === "done" || t.status === "cancelled")) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        (t.description ?? "").toLowerCase().includes(q) ||
        (t.assigneeName ?? "").toLowerCase().includes(q)
      );
    });
  }, [tasks, assigneeFilter, hideClosed, search]);

  /** Перенос карточки: сразу двигаем в интерфейсе, при ошибке откатываем */
  async function move(task: Task, status: TaskStatus) {
    await patchTask(task, { status });
  }

  /** Свободную задачу можно забрать себе — обычно это автоматическая */
  async function take(task: Task) {
    if (!user) return;
    await patchTask(task, { assigneeId: user.id, status: task.status === "todo" ? "in_progress" : task.status });
  }

  async function patchTask(task: Task, patch: Partial<Task>) {
    const prev = tasks;
    setTasks((list) => list.map((t) => (t.id === task.id ? { ...t, ...patch } : t)));
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      setTasks(prev);
      alert("Не удалось изменить задачу");
      return;
    }
    const updated: Task = await res.json();
    setTasks((list) => list.map((t) => (t.id === updated.id ? updated : t)));
  }

  if (!can("tasks.view")) {
    return (
      <div className="grid h-full place-items-center p-6 text-center text-[14.5px] text-[var(--color-text-muted)]">
        Нет доступа к разделу «Темп»
      </div>
    );
  }

  const TABS: { key: Tab; label: string; show: boolean }[] = [
    { key: "mine", label: "Моя работа", show: true },
    { key: "board", label: "Доска", show: true },
    { key: "people", label: "Люди", show: canManageAll },
    { key: "kpi", label: "KPI", show: true },
  ];

  const filterName = assigneeFilter
    ? assigneeFilter === "free"
      ? "свободные"
      : assignees.find((a) => a.id === assigneeFilter)?.name ?? "сотрудник"
    : "";

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]/70 px-4 py-3 backdrop-blur sm:px-6 sm:py-4">
        <div className="min-w-0">
          <h1 className="font-display text-[20px] font-bold">Темп</h1>
          <p className="text-[14px] text-[var(--color-text-muted)]">
            {canManageAll ? "Задачи сотрудников, загрузка и KPI" : "Ваши задачи и личный KPI"}
          </p>
        </div>
        {canManageAll && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 whitespace-nowrap rounded-[10px] bg-[var(--color-primary)] px-4 py-2 text-[14px] font-semibold text-[var(--color-on-primary)] shadow-[var(--shadow-primary)] transition hover:bg-[var(--color-primary-hover)]"
          >
            <Plus className="h-3.5 w-3.5" /> Новая задача
          </button>
        )}
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-bg)] p-1">
            {TABS.filter((t) => t.show).map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "rounded-[8px] px-3.5 py-1.5 text-[13.5px] font-semibold transition",
                  tab === t.key ? "bg-[var(--color-surface)] text-[var(--color-primary)] shadow-sm" : "text-[var(--color-text-muted)]"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "board" && (
            <>
              <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Поиск по задаче или исполнителю"
                  className="w-full rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] py-2 pl-9 pr-3 text-[14px] outline-none transition focus:border-[var(--color-primary)]"
                />
              </div>

              {canManageAll && (
                <select
                  value={assigneeFilter}
                  onChange={(e) => setAssigneeFilter(e.target.value)}
                  className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[14px] font-medium text-[var(--color-text-muted)] outline-none"
                >
                  <option value="">Все сотрудники</option>
                  <option value="free">Свободные задачи</option>
                  {assignees.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              )}

              <label className="flex cursor-pointer select-none items-center gap-2 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[13.5px] font-medium text-[var(--color-text-muted)]">
                <input
                  type="checkbox"
                  checked={hideClosed}
                  onChange={(e) => setHideClosed(e.target.checked)}
                  className="h-4 w-4 accent-[var(--color-primary)]"
                />
                Скрыть закрытые
              </label>
            </>
          )}
        </div>

        {tab === "board" && filterName && (
          <button
            onClick={() => setAssigneeFilter("")}
            className="flex items-center gap-1.5 rounded-full bg-[var(--color-primary-soft)] px-3 py-1 text-[13px] font-semibold text-[var(--color-primary)]"
          >
            Показаны задачи: {filterName} <X className="h-3.5 w-3.5" />
          </button>
        )}

        {loading ? (
          <p className="py-10 text-center text-[14px] text-[var(--color-text-muted)]">Загрузка…</p>
        ) : tab === "mine" ? (
          <MyWork
            tasks={tasks}
            currentUserId={user?.id ?? ""}
            canOpen={canManageAll}
            onOpen={setEditing}
            onMove={move}
            onTake={take}
          />
        ) : tab === "people" ? (
          <TaskPeople
            onPick={(userId) => {
              setAssigneeFilter(userId);
              setTab("board");
            }}
          />
        ) : tab === "board" ? (
          boardTasks.length === 0 ? (
            <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] py-16 text-center card-shadow">
              <p className="text-[14.5px] text-[var(--color-text-muted)]">
                {tasks.length === 0
                  ? canManageAll
                    ? "Задач пока нет — поставьте первую"
                    : "Вам пока не поставили задач"
                  : "Под фильтр ничего не подходит"}
              </p>
            </div>
          ) : (
            <TaskBoard
              tasks={boardTasks}
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
