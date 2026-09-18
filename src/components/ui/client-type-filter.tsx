"use client";

import { cn } from "@/lib/utils";
import { CLIENT_TYPE_FILTER_OPTIONS, type ClientTypeFilter } from "@/lib/client-type";

/**
 * Переключатель «Все / Физлица / Юрлица». Один и тот же на всех экранах,
 * чтобы менеджер не искал его каждый раз в новом месте и новом виде.
 */
export function ClientTypeFilterToggle({
  value,
  onChange,
  className,
}: {
  value: ClientTypeFilter;
  onChange: (value: ClientTypeFilter) => void;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Тип клиента"
      className={cn("inline-flex shrink-0 items-center gap-1 rounded-[10px] bg-[var(--color-bg)] p-1", className)}
    >
      {CLIENT_TYPE_FILTER_OPTIONS.map((option) => (
        <button
          key={option.key}
          type="button"
          role="radio"
          aria-checked={value === option.key}
          onClick={() => onChange(option.key)}
          className={cn(
            "whitespace-nowrap rounded-[8px] px-2.5 py-1.5 text-[13px] font-semibold transition",
            value === option.key
              ? "bg-[var(--color-surface)] text-[var(--color-primary-ink)] shadow-sm"
              : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
