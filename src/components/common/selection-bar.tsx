"use client";

import { cn } from "@/lib/utils";
import { CheckSquare, Loader2, Trash2, X } from "lucide-react";

/**
 * Плашка массовых действий. Всплывает снизу, когда что-то отмечено, и не даёт
 * промахнуться: сначала видно, сколько выбрано, и только потом — удаление.
 */
/** «1 аренда», «2 аренды», «5 аренд» — иначе плашка читается как машинный перевод */
function plural(n: number, one: string, few: string, many: string) {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return many;
  const mod10 = n % 10;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

export function SelectionBar({
  count,
  total,
  busy,
  onSelectAll,
  onClear,
  onDelete,
  noun,
}: {
  count: number;
  /** Сколько всего строк сейчас на экране — с учётом фильтров */
  total: number;
  busy?: boolean;
  onSelectAll: () => void;
  onClear: () => void;
  onDelete: () => void;
  /** Три формы слова: «аренда», «аренды», «аренд» */
  noun: [string, string, string];
}) {
  if (count === 0) return null;
  const allSelected = count >= total;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-5 safe-bottom">
      <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 shadow-lg">
        <span className="px-1 text-[14px] font-semibold">
          Выбрано {count} {plural(count, noun[0], noun[1], noun[2])}
        </span>

        {!allSelected && (
          <button
            onClick={onSelectAll}
            className="flex items-center gap-1.5 rounded-[10px] border border-[var(--color-border)] px-3 py-1.5 text-[13.5px] font-medium text-[var(--color-text-muted)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary-ink)]"
          >
            <CheckSquare className="h-3.5 w-3.5" /> Выбрать все ({total})
          </button>
        )}

        <button
          onClick={onClear}
          className="flex items-center gap-1.5 rounded-[10px] border border-[var(--color-border)] px-3 py-1.5 text-[13.5px] font-medium text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg)]"
        >
          <X className="h-3.5 w-3.5" /> Снять выделение
        </button>

        <button
          onClick={onDelete}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-[10px] bg-[#C0272D] px-3.5 py-1.5 text-[13.5px] font-semibold text-white transition hover:bg-[#A31F24] disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          {busy ? "Удаляем…" : "Удалить"}
        </button>
      </div>
    </div>
  );
}

/** Квадратный чекбокс в стиле проекта — нативный слишком мелкий для касания */
export function SelectBox({ checked, className }: { checked: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[5px] border-2 transition",
        checked ? "border-[var(--color-primary)] bg-[var(--color-primary)]" : "border-[var(--color-border)] bg-[var(--color-surface)]",
        className
      )}
    >
      {checked && (
        <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 text-[var(--color-on-primary)]" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path d="M1.5 6.5L4.5 9.5L10.5 2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  );
}

/**
 * Подтверждение массового удаления. Нативный confirm() тут не годится: он не
 * умеет показывать список последствий и на телефоне выглядит чужеродно.
 */
export function ConfirmDeleteModal({
  title,
  lines,
  extra,
  busy,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title: string;
  /** Что именно произойдёт — по строке на пункт */
  lines: string[];
  /** Дополнительный переключатель (например «удалить вместе с арендами») */
  extra?: React.ReactNode;
  busy?: boolean;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-4 sm:items-center sm:pb-0" onClick={onCancel}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[420px] rounded-[16px] bg-[var(--color-surface)] p-5 card-shadow"
      >
        <div className="flex items-start gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#FDECEC] text-[#C0272D]">
            <Trash2 className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h3 className="text-[16px] font-semibold">{title}</h3>
            <p className="text-[13.5px] text-[var(--color-text-muted)]">Восстановить данные будет нельзя</p>
          </div>
        </div>

        <ul className="mt-4 space-y-1.5 rounded-[10px] bg-[var(--color-bg)] px-3.5 py-3 text-[13.5px]">
          {lines.map((l) => (
            <li key={l} className="text-[var(--color-text-muted)]">
              {l}
            </li>
          ))}
        </ul>

        {extra && <div className="mt-3">{extra}</div>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="rounded-[10px] border border-[var(--color-border)] px-4 py-2.5 text-[14px] font-semibold text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg)]"
          >
            Отмена
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-[10px] bg-[#C0272D] px-4 py-2.5 text-[14px] font-semibold text-white transition hover:bg-[#A31F24] disabled:opacity-60"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {busy ? "Удаляем…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
