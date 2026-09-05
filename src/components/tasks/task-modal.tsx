"use client";

import { useEffect, useState } from "react";
import { Task, TaskPriority, TaskStatus, TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Trash2, X } from "lucide-react";

export interface Assignee {
  id: string;
  name: string;
  position: string;
}

/** Дата для input[type=datetime-local] в местном времени */
function toLocalInput(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function TaskModal({
  task,
  assignees,
  onClose,
  onSaved,
}: {
  task?: Task;
  assignees: Assignee[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? "todo");
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? "normal");
  const [assigneeId, setAssigneeId] = useState(task?.assigneeId ?? "");
  const [dueAt, setDueAt] = useState(toLocalInput(task?.dueAt));
  const [points, setPoints] = useState(String(task?.points ?? 1));
  const [visibleTo, setVisibleTo] = useState<string[]>(task?.visibleTo ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Исполнителю показывать себя в списке зрителей незачем — он и так видит задачу
    if (assigneeId) setVisibleTo((prev) => prev.filter((id) => id !== assigneeId));
  }, [assigneeId]);

  function toggleViewer(id: string) {
    setVisibleTo((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function save() {
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    const payload = {
      title: title.trim(),
      description: description.trim() || undefined,
      status,
      priority,
      assigneeId: assigneeId || undefined,
      dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
      points: Math.max(1, Number(points) || 1),
      visibleTo,
    };
    try {
      const res = await fetch(task ? `/api/tasks/${task.id}` : "/api/tasks", {
        method: task ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Не удалось сохранить задачу");
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить задачу");
      setSaving(false);
    }
  }

  async function remove() {
    if (!task || !confirm(`Удалить задачу «${task.title}»?`)) return;
    setSaving(true);
    await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[20px] bg-[var(--color-surface)] p-4 pb-8 shadow-xl safe-bottom sm:rounded-[var(--radius-card)] sm:p-6 sm:pb-6"
      >
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="font-display text-[18px] font-bold">{task ? "Задача" : "Новая задача"}</h2>
            <p className="text-[12.5px] text-[var(--color-text-muted)]">
              {task?.createdByName ? `Поставил: ${task.createdByName}` : "Исполнитель увидит её у себя в «Темпе»"}
            </p>
          </div>
          <button onClick={onClose} className="text-[var(--color-text-muted)] transition hover:text-[#C0272D]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-[12.5px] font-medium text-[var(--color-text-muted)]">
            Название <span className="text-[var(--color-primary)]">*</span>
          </span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="crm-input" placeholder="Принять инструмент с объекта" />
        </label>

        <label className="mt-4 block">
          <span className="mb-1.5 block text-[12.5px] font-medium text-[var(--color-text-muted)]">Описание</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="crm-input" />
        </label>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-medium text-[var(--color-text-muted)]">Исполнитель</span>
            <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className="crm-input">
              <option value="">Не назначен</option>
              {assignees.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                  {u.position ? ` — ${u.position}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-medium text-[var(--color-text-muted)]">Срок</span>
            <input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className="crm-input" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-medium text-[var(--color-text-muted)]">Приоритет</span>
            <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)} className="crm-input">
              {Object.entries(TASK_PRIORITY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-medium text-[var(--color-text-muted)]">Статус</span>
            <select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)} className="crm-input">
              {Object.entries(TASK_STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="mt-4 block">
          <span className="mb-1.5 block text-[12.5px] font-medium text-[var(--color-text-muted)]">Вес в KPI</span>
          <input type="number" min={1} max={10} value={points} onChange={(e) => setPoints(e.target.value)} className="crm-input" />
          <span className="mt-1 block text-[11.5px] text-[var(--color-text-muted)]">
            Сколько баллов сотрудник получит за выполнение. Рутина — 1, крупная задача — 3–5.
          </span>
        </label>

        <div className="mt-5">
          <span className="mb-2 block text-[12.5px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            Кому ещё видна задача
          </span>
          <p className="mb-2 text-[11.5px] text-[var(--color-text-muted)]">
            По умолчанию задачу видят только исполнитель и постановщик. Отметьте, кому открыть просмотр.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {assignees
              .filter((u) => u.id !== assigneeId)
              .map((u) => {
                const on = visibleTo.includes(u.id);
                return (
                  <button
                    key={u.id}
                    onClick={() => toggleViewer(u.id)}
                    className={cn(
                      "rounded-[8px] border px-2.5 py-1 text-[12px] font-medium transition",
                      on
                        ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
                        : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)]"
                    )}
                  >
                    {u.name}
                  </button>
                );
              })}
          </div>
        </div>

        {error && <p className="mt-3 text-[13px] text-[#C0272D]">{error}</p>}

        <div className="mt-6 flex items-center justify-end gap-2">
          {task && (
            <button
              onClick={remove}
              disabled={saving}
              className="mr-auto flex items-center gap-1.5 rounded-[10px] border border-[var(--color-border)] px-3 py-2.5 text-[13px] font-semibold text-[#C0272D] transition hover:bg-[#FDECEC]"
            >
              <Trash2 className="h-3.5 w-3.5" /> Удалить
            </button>
          )}
          <button onClick={onClose} className="rounded-[10px] border border-[var(--color-border)] px-4 py-2.5 text-[13.5px] font-semibold text-[var(--color-text-muted)]">
            Отмена
          </button>
          <button
            disabled={saving || !title.trim()}
            onClick={save}
            className="rounded-[10px] bg-[var(--color-primary)] px-5 py-2.5 text-[13.5px] font-semibold text-[var(--color-on-primary)] transition hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "Сохранение…" : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}
