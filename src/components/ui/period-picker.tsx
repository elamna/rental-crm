"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarRange, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { PeriodKey, PeriodValue } from "@/lib/period";

const QUICK: { key: PeriodKey; label: string }[] = [
  { key: "day", label: "24 часа" },
  { key: "week", label: "7 дней" },
  { key: "month", label: "30 дней" },
  { key: "year", label: "12 месяцев" },
  { key: "all", label: "Всё время" },
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatRu(date?: string) {
  if (!date) return "";
  const [y, m, d] = date.split("-");
  return `${d}.${m}.${y}`;
}

/** Переключатель периода: быстрые кнопки плюс произвольный диапазон дат */
export function PeriodPicker({ value, onChange }: { value: PeriodValue; onChange: (v: PeriodValue) => void }) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(value.from ?? today());
  const [to, setTo] = useState(value.to ?? today());
  const boxRef = useRef<HTMLDivElement>(null);

  // Клик мимо панели закрывает её
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const isCustom = value.key === "custom";
  const invalid = from > to;

  function apply() {
    if (invalid) return;
    onChange({ key: "custom", from, to });
    setOpen(false);
  }

  return (
    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
      <div className="flex w-full items-center gap-1 overflow-x-auto rounded-[10px] border border-[var(--color-border)] bg-[var(--color-bg)] p-1 sm:w-auto">
        {QUICK.map((p) => (
          <button
            key={p.key}
            onClick={() => onChange({ key: p.key })}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-[8px] px-3 py-1.5 text-[12.5px] font-medium transition",
              value.key === p.key
                ? "bg-[var(--color-surface)] text-[var(--color-primary)] shadow-sm"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div ref={boxRef} className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "flex items-center gap-1.5 whitespace-nowrap rounded-[10px] border px-3 py-2 text-[12.5px] font-medium transition",
            isCustom
              ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
              : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)]"
          )}
        >
          <CalendarRange className="h-3.5 w-3.5" />
          {isCustom && value.from && value.to ? `${formatRu(value.from)} — ${formatRu(value.to)}` : "Выбрать даты"}
        </button>

        {open && (
          <div className="absolute right-0 z-30 mt-2 w-[280px] rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5 shadow-xl">
            <span className="mb-2 block text-[12px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              Свой период
            </span>
            <div className="space-y-2">
              <label className="block">
                <span className="mb-1 block text-[11.5px] text-[var(--color-text-muted)]">С какого числа</span>
                <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="crm-input" />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11.5px] text-[var(--color-text-muted)]">По какое число</span>
                <input type="date" value={to} min={from} max={today()} onChange={(e) => setTo(e.target.value)} className="crm-input" />
              </label>
            </div>

            {invalid && <p className="mt-2 text-[11.5px] text-[#C0272D]">Начало периода позже конца</p>}

            <button
              onClick={apply}
              disabled={invalid}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-[10px] bg-[var(--color-primary)] py-2 text-[13px] font-semibold text-[var(--color-on-primary)] transition hover:bg-[var(--color-primary-hover)] disabled:opacity-40"
            >
              <Check className="h-3.5 w-3.5" /> Применить
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
