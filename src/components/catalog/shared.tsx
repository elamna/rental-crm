"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Download, Search } from "lucide-react";

export interface StatItem {
  value: ReactNode;
  label: string;
  pct?: string;
  muted?: boolean;
}

export function StatBar({ items }: { items: StatItem[] }) {
  return (
    <div className="inline-flex flex-wrap rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white card-shadow">
      {items.map((it, i) => (
        <div key={it.label} className={cn("px-5 py-3", i > 0 && "border-l border-[var(--color-border)]")}>
          <div className="flex items-baseline gap-1.5">
            <span className={cn("font-display text-[18px] font-bold", it.muted && "text-[var(--color-text-muted)]")}>{it.value}</span>
            {it.pct && (
              <span className="rounded-full bg-[var(--color-primary-soft)] px-1.5 py-[1px] text-[10.5px] font-semibold text-[var(--color-primary)]">
                {it.pct}
              </span>
            )}
          </div>
          <div className="text-[11.5px] text-[var(--color-text-muted)]">{it.label}</div>
        </div>
      ))}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Поиск",
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative min-w-[200px]", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-[12px] border border-[var(--color-border)] bg-white py-2.5 pl-9 pr-3 text-[13.5px] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-soft)]"
      />
    </div>
  );
}

export function FilterSelect({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-[12px] border border-[var(--color-border)] bg-white px-3 py-2.5 text-[13px] font-medium text-[var(--color-text-muted)] outline-none transition focus:border-[var(--color-primary)]"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label className="flex cursor-pointer select-none items-center gap-2 rounded-[12px] border border-[var(--color-border)] bg-white px-3 py-2.5 text-[13px] font-medium text-[var(--color-text-muted)]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-[var(--color-primary)]"
      />
      {label}
    </label>
  );
}

export function ExportButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-[12px] border border-[var(--color-border)] bg-white px-3.5 py-2.5 text-[13px] font-semibold text-[var(--color-text-muted)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
    >
      <Download className="h-3.5 w-3.5" /> Экспорт
    </button>
  );
}

export function TableCard({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white card-shadow">
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

export function Th({
  children,
  sortable,
  active,
  dir,
  onSort,
  className,
}: {
  children?: ReactNode;
  sortable?: boolean;
  active?: boolean;
  dir?: "asc" | "desc";
  onSort?: () => void;
  className?: string;
}) {
  return (
    <th className={cn("whitespace-nowrap px-4 py-3 text-left text-[12.5px] font-semibold text-[var(--color-text-muted)]", className)}>
      {sortable ? (
        <button onClick={onSort} className={cn("flex items-center gap-1 transition hover:text-[var(--color-primary)]", active && "text-[var(--color-primary)]")}>
          {children}
          <span className="text-[9px] leading-none opacity-60">{active ? (dir === "asc" ? "▲" : "▼") : "⇅"}</span>
        </button>
      ) : (
        children
      )}
    </th>
  );
}

export function Pill({ tone, children }: { tone: "green" | "red" | "amber" | "violet" | "grey"; children: ReactNode }) {
  const tones = {
    green: "bg-[#EAF7EE] text-[#1C8A46]",
    red: "bg-[#FDECEC] text-[#C0272D]",
    amber: "bg-[#FFF4E5] text-[#B8620A]",
    violet: "bg-[#EFEBFF] text-[#6D4AFF]",
    grey: "bg-[#F1F2F6] text-[#8A8F9C]",
  } as const;
  return <span className={cn("inline-block rounded-[8px] px-3 py-1 text-center text-[12px] font-semibold", tones[tone])}>{children}</span>;
}

export function EmptyRow({ colSpan, text }: { colSpan: number; text: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-14 text-center text-[13.5px] text-[var(--color-text-muted)]">
        {text}
      </td>
    </tr>
  );
}

export function Pagination({
  total,
  page,
  perPage,
  onPage,
  onPerPage,
}: {
  total: number;
  page: number;
  perPage: number;
  onPage: (p: number) => void;
  onPerPage: (n: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  const around = [page - 1, page, page + 1].filter((p) => p >= 1 && p <= pages);
  const list = [...new Set([1, ...around, pages])].sort((a, b) => a - b);

  return (
    <div className="flex flex-wrap items-center gap-3 px-1 py-3">
      <select
        value={perPage}
        onChange={(e) => {
          onPerPage(Number(e.target.value));
          onPage(1);
        }}
        className="rounded-[10px] border border-[var(--color-border)] bg-white px-2.5 py-1.5 text-[12.5px] outline-none focus:border-[var(--color-primary)]"
      >
        {[10, 25, 50, 100].map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      <span className="text-[12.5px] text-[var(--color-text-muted)]">Всего: {total}</span>

      {pages > 1 && (
        <div className="ml-auto flex items-center gap-1">
          <PageBtn disabled={page === 1} onClick={() => onPage(page - 1)}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </PageBtn>
          {list.map((p, i) => (
            <span key={p} className="flex items-center gap-1">
              {i > 0 && p - list[i - 1] > 1 && <span className="px-1 text-[12px] text-[var(--color-text-muted)]">…</span>}
              <PageBtn active={p === page} onClick={() => onPage(p)}>
                {p}
              </PageBtn>
            </span>
          ))}
          <PageBtn disabled={page === pages} onClick={() => onPage(page + 1)}>
            <ChevronRight className="h-3.5 w-3.5" />
          </PageBtn>
        </div>
      )}
    </div>
  );
}

function PageBtn({
  children,
  active,
  disabled,
  onClick,
}: {
  children: ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "grid h-7 min-w-7 place-items-center rounded-[8px] border px-2 text-[12.5px] font-medium transition",
        active
          ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
          : "border-[var(--color-border)] bg-white text-[var(--color-text-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]",
        disabled && "cursor-not-allowed opacity-40"
      )}
    >
      {children}
    </button>
  );
}

/** Разбивка списка на страницу */
export function paginate<T>(list: T[], page: number, perPage: number) {
  const start = (page - 1) * perPage;
  return list.slice(start, start + perPage);
}
