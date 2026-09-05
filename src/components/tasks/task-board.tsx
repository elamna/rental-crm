"use client";

import { useMemo, useState } from "react";
import { Task, TaskStatus, TASK_STATUS_LABELS } from "@/lib/types";
import { cn, formatDateTimeDisplay } from "@/lib/utils";
import { useIsMobile } from "@/lib/use-is-mobile";
import { CalendarClock, Flame, User } from "lucide-react";

const COLUMNS: { key: TaskStatus; tone: string }[] = [
  { key: "todo", tone: "bg-[#F1F2F6]" },
  { key: "in_progress", tone: "bg-[#FFF4E5]" },
  { key: "review", tone: "bg-[#E9F0FE]" },
  { key: "done", tone: "bg-[#EAF7EE]" },
  { key: "cancelled", tone: "bg-[#F1F2F6]" },
];

export function TaskBoard({
  tasks,
  currentUserId,
  canManageAll,
  onOpen,
  onMove,
}: {
  tasks: Task[];
  currentUserId: string;
  canManageAll: boolean;
  onOpen: (task: Task) => void;
  onMove: (task: Task, status: TaskStatus) => void;
}) {
  const isMobile = useIsMobile();
  const [dragging, setDragging] = useState<Task | null>(null);

  const byStatus = useMemo(() => {
    const map = new Map<TaskStatus, Task[]>();
    for (const c of COLUMNS) map.set(c.key, []);
    for (const t of tasks) map.get(t.status)?.push(t);
    return map;
  }, [tasks]);

  /** Двигать задачу может постановщик со всеми правами либо её исполнитель */
  function canMove(task: Task) {
    return canManageAll || task.assigneeId === currentUserId;
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {COLUMNS.map((col) => {
        const items = byStatus.get(col.key) ?? [];
        return (
          <div
            key={col.key}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragging && dragging.status !== col.key && canMove(dragging)) onMove(dragging, col.key);
              setDragging(null);
            }}
            className="flex w-[260px] shrink-0 flex-col rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] card-shadow"
          >
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3.5 py-2.5">
              <span className="text-[13px] font-semibold">{TASK_STATUS_LABELS[col.key]}</span>
              <span className={cn("rounded-full px-2 py-0.5 text-[11.5px] font-semibold text-[var(--color-text-muted)]", col.tone)}>
                {items.length}
              </span>
            </div>

            <div className="flex-1 space-y-2 p-2.5">
              {items.length === 0 ? (
                <p className="py-6 text-center text-[12px] text-[var(--color-text-muted)]">Пусто</p>
              ) : (
                items.map((t) => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    movable={canMove(t)}
                    isMobile={isMobile}
                    onOpen={() => onOpen(t)}
                    onDragStart={() => setDragging(t)}
                    onMove={(s) => onMove(t, s)}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TaskCard({
  task,
  movable,
  isMobile,
  onOpen,
  onDragStart,
  onMove,
}: {
  task: Task;
  movable: boolean;
  isMobile: boolean;
  onOpen: () => void;
  onDragStart: () => void;
  onMove: (status: TaskStatus) => void;
}) {
  const overdue = task.dueAt && task.status !== "done" && task.status !== "cancelled" && new Date(task.dueAt) < new Date();

  return (
    <div
      draggable={movable && !isMobile}
      onDragStart={onDragStart}
      className={cn(
        "rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5 transition hover:border-[var(--color-primary)]",
        movable && !isMobile && "cursor-grab active:cursor-grabbing"
      )}
    >
      <button onClick={onOpen} className="block w-full text-left">
        <div className="flex items-start gap-1.5">
          {task.priority === "high" && <Flame className="mt-[2px] h-3.5 w-3.5 shrink-0 text-[#C0272D]" />}
          <span className="text-[13px] font-semibold leading-snug">{task.title}</span>
        </div>

        <div className="mt-2 space-y-1 text-[11.5px] text-[var(--color-text-muted)]">
          <span className="flex items-center gap-1.5">
            <User className="h-3 w-3 shrink-0" />
            {task.assigneeName ?? "не назначен"}
          </span>
          {task.dueAt && (
            <span className={cn("flex items-center gap-1.5", overdue && "font-semibold text-[#C0272D]")}>
              <CalendarClock className="h-3 w-3 shrink-0" />
              {formatDateTimeDisplay(task.dueAt)}
            </span>
          )}
        </div>
      </button>

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="rounded-[6px] bg-[var(--color-primary-soft)] px-1.5 py-0.5 text-[10.5px] font-semibold text-[var(--color-primary)]">
          {task.points} балл{task.points === 1 ? "" : task.points < 5 ? "а" : "ов"}
        </span>

        {/* На телефоне перетаскивание неудобно — статус меняется выбором */}
        {movable && isMobile && (
          <select
            value={task.status}
            onChange={(e) => onMove(e.target.value as TaskStatus)}
            className="rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-1 text-[11.5px]"
          >
            {Object.entries(TASK_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
