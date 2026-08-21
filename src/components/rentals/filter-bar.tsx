"use client";

import { Search, Calendar, ChevronDown, LayoutGrid, List, SlidersHorizontal } from "lucide-react";

export function FilterBar({
  search,
  onSearch,
  view,
  onView,
}: {
  search: string;
  onSearch: (v: string) => void;
  view: "grid" | "list";
  onView: (v: "grid" | "list") => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[220px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Поиск по клиенту, номеру, телефону…"
          className="w-full rounded-[12px] border border-[var(--color-border)] bg-white py-2.5 pl-9 pr-3 text-[13.5px] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-soft)]"
        />
      </div>

      <FilterPill icon={Calendar} label="Начало → Конец" />
      <FilterPill label="Пункт проката" />
      <FilterPill label="Статус оплаты" />
      <FilterPill label="Доставка" />

      <button className="flex items-center gap-1.5 rounded-[12px] border border-[var(--color-border)] bg-white px-3 py-2.5 text-[13px] font-medium text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg)]">
        <SlidersHorizontal className="h-3.5 w-3.5" />
        Ещё
      </button>

      <div className="ml-auto flex items-center gap-1 rounded-[12px] border border-[var(--color-border)] bg-white p-1">
        <button
          onClick={() => onView("list")}
          className={`grid h-7 w-7 place-items-center rounded-[8px] transition ${
            view === "list" ? "bg-[var(--color-primary-soft)] text-[var(--color-primary)]" : "text-[var(--color-text-muted)]"
          }`}
        >
          <List className="h-4 w-4" />
        </button>
        <button
          onClick={() => onView("grid")}
          className={`grid h-7 w-7 place-items-center rounded-[8px] transition ${
            view === "grid" ? "bg-[var(--color-primary-soft)] text-[var(--color-primary)]" : "text-[var(--color-text-muted)]"
          }`}
        >
          <LayoutGrid className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function FilterPill({ label, icon: Icon }: { label: string; icon?: React.ElementType }) {
  return (
    <button className="flex items-center gap-1.5 rounded-[12px] border border-[var(--color-border)] bg-white px-3 py-2.5 text-[13px] font-medium text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg)]">
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {label}
      <ChevronDown className="h-3.5 w-3.5" />
    </button>
  );
}
