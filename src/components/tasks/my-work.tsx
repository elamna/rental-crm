"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Task, TaskStatus, TASK_SOURCE_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ArrowRight, Check, ChevronDown, ChevronRight, ExternalLink, Flame, HandHelping, Play } from "lucide-react";

const ACTIVE: TaskStatus[] = ["todo", "in_progress", "review"];

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Сколько дней осталось до конца недели (воскресенье включительно) */
function daysLeftInWeek(now: Date) {
  return 6 - ((now.getDay() + 6) % 7);
}

type Bucket = "overdue" | "today" | "tomorrow" | "week" | "later" | "nodue";

const BUCKETS: { key: Bucket; label: string; tone: string }[] = [
  { key: "overdue", label: "Просрочено", tone: "text-[#C0272D]" },
  { key: "today", label: "Сегодня", tone: "text-[#B8620A]" },
  { key: "tomorrow", label: "Завтра", tone: "text-[var(--color-text)]" },
  { key: "week", label: "На этой неделе", tone: "text-[var(--color-text)]" },
  { key: "later", label: "Позже", tone: "text-[var(--color-text-muted)]" },
  { key: "nodue", label: "Без срока", tone: "text-[var(--color-text-muted)]" },
];

function bucketOf(task: Task, now: Date): Bucket {
  if (!task.dueAt) return "nodue";
  const due = new Date(task.dueAt).getTime();
  if (isNaN(due)) return "nodue";
  if (due < now.getTime()) return "overdue";

  const diff = Math.round((startOfDay(new Date(due)) - startOfDay(now)) / 86400000);
  if (diff <= 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff <= daysLeftInWeek(now)) return "week";
  return "later";
}

function formatDue(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return `${d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}${time === "00:00" ? "" : `, ${time}`}`;
}

/**
 * «Моя работа» — экран сотрудника.
 *
 * Доска отвечает на вопрос «как идут дела у всех», а человеку с утра нужен
 * ответ на другой: что делать прямо сейчас. Поэтому здесь не колонки статусов,
 * а список по срокам — сверху то, что уже горит. Двадцать своих задач так
 * читаются за минуту и помещаются в телефон.
 */
export function MyWork({
  tasks,
  currentUserId,
  canOpen,
  onOpen,
  onMove,
  onTake,
}: {
  tasks: Task[];
  currentUserId: string;
  /** Карточку открывает только тот, кто может её править — остальным клик ни к чему */
  canOpen: boolean;
  onOpen: (task: Task) => void;
  onMove: (task: Task, status: TaskStatus) => void;
  onTake: (task: Task) => void;
}) {
  const now = new Date();
  const [showDone, setShowDone] = useState(false);

  const mine = useMemo(
    () => tasks.filter((t) => t.assigneeId === currentUserId && ACTIVE.includes(t.status)),
    [tasks, currentUserId]
  );
  const free = useMemo(() => tasks.filter((t) => !t.assigneeId && ACTIVE.includes(t.status)), [tasks]);
  const doneToday = useMemo(
    () =>
      tasks.filter(
        (t) =>
          t.assigneeId === currentUserId &&
          t.status === "done" &&
          t.doneAt &&
          startOfDay(new Date(t.doneAt)) === startOfDay(now)
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, currentUserId]
  );

  const grouped = useMemo(() => {
    const map = new Map<Bucket, Task[]>();
    for (const b of BUCKETS) map.set(b.key, []);
    for (const t of mine) map.get(bucketOf(t, now))?.push(t);
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mine]);

  const overdueCount = grouped.get("overdue")?.length ?? 0;
  const todayCount = grouped.get("today")?.length ?? 0;
  const inProgress = mine.filter((t) => t.status === "in_progress").length;

  return (
    <div className="space-y-4">
      {/* Строка состояния: три числа, ради которых сюда заходят */}
      <div className="grid grid-cols-3 gap-2 sm:max-w-lg">
        <Stat label="Просрочено" value={overdueCount} tone={overdueCount > 0 ? "#C0272D" : undefined} />
        <Stat label="На сегодня" value={todayCount} tone={todayCount > 0 ? "#B8620A" : undefined} />
        <Stat label="В работе" value={inProgress} />
      </div>

      {mine.length === 0 && free.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] py-16 text-center card-shadow">
          <Check className="mx-auto h-7 w-7 text-[#1C8A46]" />
          <p className="mt-2 text-[14.5px] text-[var(--color-text-muted)]">Задач на вас нет — всё закрыто</p>
        </div>
      ) : (
        BUCKETS.map((b) => {
          const items = grouped.get(b.key) ?? [];
          if (items.length === 0) return null;
          return (
            <section key={b.key}>
              <h3 className={cn("mb-2 text-[14px] font-bold", b.tone)}>
                {b.label} <span className="text-[var(--color-text-muted)]">· {items.length}</span>
              </h3>
              <div className="space-y-1.5">
                {items.map((t) => (
                  <TaskRow key={t.id} task={t} canOpen={canOpen} onOpen={() => onOpen(t)} onMove={(s) => onMove(t, s)} />
                ))}
              </div>
            </section>
          );
        })
      )}

      {free.length > 0 && (
        <section>
          <h3 className="mb-1 flex items-center gap-2 text-[14px] font-bold">
            <HandHelping className="h-4 w-4 text-[var(--color-text-muted)]" /> Свободные задачи
            <span className="text-[var(--color-text-muted)]">· {free.length}</span>
          </h3>
          <p className="mb-2 text-[13px] text-[var(--color-text-muted)]">
            Система нашла их сама и не смогла определить, чьи они. Возьмите ту, что ваша.
          </p>
          <div className="space-y-1.5">
            {free.map((t) => (
              <TaskRow key={t.id} task={t} canOpen={canOpen} onOpen={() => onOpen(t)} onMove={(s) => onMove(t, s)} onTake={() => onTake(t)} />
            ))}
          </div>
        </section>
      )}

      {doneToday.length > 0 && (
        <section>
          <button
            onClick={() => setShowDone((v) => !v)}
            className="flex items-center gap-1.5 text-[14px] font-bold text-[var(--color-text-muted)]"
          >
            {showDone ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            Закрыто сегодня · {doneToday.length}
          </button>
          {showDone && (
            <div className="mt-2 space-y-1.5">
              {doneToday.map((t) => (
                <TaskRow key={t.id} task={t} canOpen={canOpen} onOpen={() => onOpen(t)} onMove={(s) => onMove(t, s)} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

/** Одна и та же строка задачи и кликабельной кнопкой, и обычным блоком */
function Content({
  as: Tag,
  onClick,
  children,
}: {
  as: "button" | "div";
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tag onClick={onClick} className="min-w-0 flex-1 text-left">
      {children}
    </Tag>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 card-shadow">
      <div className="text-[20px] font-bold" style={tone ? { color: tone } : undefined}>
        {value}
      </div>
      <div className="text-[12.5px] text-[var(--color-text-muted)]">{label}</div>
    </div>
  );
}

function TaskRow({
  task,
  canOpen,
  onOpen,
  onMove,
  onTake,
}: {
  task: Task;
  canOpen: boolean;
  onOpen: () => void;
  onMove: (status: TaskStatus) => void;
  onTake?: () => void;
}) {
  const done = task.status === "done";
  const overdue = !done && task.dueAt && new Date(task.dueAt) < new Date();

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-[12px] border bg-[var(--color-surface)] px-3 py-2.5 card-shadow transition",
        overdue ? "border-[#F3B7B7]" : "border-[var(--color-border)]",
        done && "opacity-60"
      )}
    >
      {/* Кому нельзя править задачу — тому и открывать нечего: всё нужное видно в строке */}
      <Content as={canOpen ? "button" : "div"} onClick={canOpen ? onOpen : undefined}>
        <div className="flex items-center gap-1.5">
          {task.priority === "high" && !done && <Flame className="h-3.5 w-3.5 shrink-0 text-[#C0272D]" />}
          <span className={cn("truncate text-[14.5px] font-semibold", done && "line-through")}>{task.title}</span>
          {task.sourceKind && (
            <span className="shrink-0 rounded-[6px] bg-[var(--color-bg)] px-1.5 py-0.5 text-[11.5px] font-medium text-[var(--color-text-muted)]">
              {TASK_SOURCE_LABELS[task.sourceKind]}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[12.5px] text-[var(--color-text-muted)]">
          {task.dueAt && <span className={cn(overdue && "font-semibold text-[#C0272D]")}>до {formatDue(task.dueAt)}</span>}
          {task.status === "in_progress" && <span>в работе</span>}
          {task.status === "review" && <span>на проверке</span>}
          {task.description && <span className="line-clamp-2">{task.description}</span>}
        </div>
      </Content>

      <div className="flex shrink-0 items-center gap-1.5">
        {task.sourceUrl && (
          <Link
            href={task.sourceUrl}
            className="flex items-center gap-1 rounded-[8px] border border-[var(--color-border)] px-2.5 py-1.5 text-[13px] font-medium text-[var(--color-primary)] transition hover:bg-[var(--color-bg)]"
            title="Открыть объект, из-за которого появилась задача"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Открыть
          </Link>
        )}
        {onTake && (
          <button
            onClick={onTake}
            className="flex items-center gap-1 rounded-[8px] border border-[var(--color-primary)] px-2.5 py-1.5 text-[13px] font-semibold text-[var(--color-primary)] transition hover:bg-[var(--color-primary-soft)]"
          >
            <ArrowRight className="h-3.5 w-3.5" /> Взять себе
          </button>
        )}
        {!onTake && task.status === "todo" && (
          <button
            onClick={() => onMove("in_progress")}
            className="flex items-center gap-1 rounded-[8px] border border-[var(--color-border)] px-2.5 py-1.5 text-[13px] font-medium transition hover:bg-[var(--color-bg)]"
          >
            <Play className="h-3.5 w-3.5" /> В работу
          </button>
        )}
        {!onTake && !done && (
          <button
            onClick={() => onMove("done")}
            className="flex items-center gap-1 rounded-[8px] border border-[#1C8A46] px-2.5 py-1.5 text-[13px] font-semibold text-[#1C8A46] transition hover:bg-[#EAF7EE]"
          >
            <Check className="h-3.5 w-3.5" /> Готово
          </button>
        )}
        {done && (
          <button
            onClick={() => onMove("todo")}
            className="rounded-[8px] border border-[var(--color-border)] px-2.5 py-1.5 text-[13px] font-medium text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg)]"
          >
            Вернуть
          </button>
        )}
      </div>
    </div>
  );
}
