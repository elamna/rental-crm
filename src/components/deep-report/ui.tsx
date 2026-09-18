"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Link from "next/link";
import { cn, formatMoney } from "@/lib/utils";

/**
 * Детали подробного отчёта. Все разделы собраны из одних и тех же кирпичей:
 * строка «главного», четыре плитки, рейтинги-полоски и один график по
 * месяцам. Так отчёт на десяток разделов читается как одна вещь, а не как
 * десяток разных экранов.
 */

type Tone = "primary" | "success" | "warning" | "danger";

const TONES: Record<Tone, string> = {
  primary: "bg-[var(--color-primary-soft)] text-[var(--color-primary-ink)]",
  success: "bg-[#EAF7EE] text-[#1C8A46]",
  warning: "bg-[#FEF6E3] text-[#B8860B]",
  danger: "bg-[#FDECEC] text-[#C0272D]",
};

/** Плитка с одной цифрой и подписью под ней */
export function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: Tone }) {
  const skin = tone ? TONES[tone] : "";
  return (
    <div className={cn("rounded-[12px] border border-[var(--color-border)] px-4 py-3", skin || "bg-[var(--color-surface)]")}>
      <div className={cn("text-[12.5px]", skin ? "font-medium" : "text-[var(--color-text-muted)]")}>{label}</div>
      <div className="mt-0.5 font-display text-[21px] font-bold leading-tight">{value}</div>
      {sub && <div className={cn("mt-0.5 text-[12.5px]", skin ? "opacity-80" : "text-[var(--color-text-muted)]")}>{sub}</div>}
    </div>
  );
}

export function Tiles({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>;
}

/** Карточка блока с заголовком и необязательной подписью */
export function Card({
  title,
  hint,
  children,
  className,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 card-shadow", className)}>
      <h3 className="text-[15px] font-semibold">{title}</h3>
      {hint && <p className="mt-0.5 text-[12.5px] text-[var(--color-text-muted)]">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function Grid2({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">{children}</div>;
}

/**
 * «Главное» раздела — две-три фразы словами, а не цифрами. Владелец открывает
 * вкладку и сразу видит вывод; цифры ниже — чтобы его проверить.
 */
export function Headline({ items }: { items: (string | null | false | undefined)[] }) {
  const lines = items.filter((x): x is string => !!x);
  if (lines.length === 0) return null;
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-primary)]/40 bg-[var(--color-primary-soft)] px-4 py-3">
      <div className="text-[12.5px] font-semibold uppercase tracking-wide text-[var(--color-primary-ink)]">Главное</div>
      <ul className="mt-1.5 space-y-1 text-[14px] text-[var(--color-text)]">
        {lines.map((line) => (
          <li key={line} className="flex gap-2">
            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-primary)]" />
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface BarRow {
  label: string;
  value: number;
  /** Что написать справа вместо самого значения: «12 шт. · 48 000 ₸» */
  display?: string;
  /** Мелкая подпись под названием */
  sub?: string;
  href?: string;
}

/**
 * Рейтинг полосками: название, полоса, значение. Это и график, и таблица
 * сразу — цифра всегда написана, поэтому цвет полосы ничего не кодирует и
 * везде один.
 */
export function BarList({ rows, empty = "Нет данных за период", format }: { rows: BarRow[]; empty?: string; format?: (v: number) => string }) {
  if (rows.length === 0) return <p className="py-4 text-center text-[13.5px] text-[var(--color-text-muted)]">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="space-y-2.5">
      {rows.map((row) => (
        <div key={row.label} className="text-[13.5px]">
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate">
              {row.href ? (
                <Link href={row.href} className="text-[var(--color-primary-ink)] underline-offset-2 hover:underline">
                  {row.label}
                </Link>
              ) : (
                row.label
              )}
              {row.sub && <span className="ml-1.5 text-[12px] text-[var(--color-text-muted)]">{row.sub}</span>}
            </span>
            <span className="shrink-0 font-semibold tabular-nums">{row.display ?? (format ? format(row.value) : row.value)}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--color-bg)]">
            <div
              className="h-full rounded-full bg-[var(--color-primary)]"
              style={{ width: `${row.value > 0 ? Math.max(2, (row.value / max) * 100) : 0}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Одна сумма, разложенная на части: полоса из сегментов и подпись под каждым.
 * Части складываются в целое — поэтому это одна полоса, а не круг и не столбики.
 */
export function SplitBar({ parts, format = formatMoney }: { parts: { label: string; value: number }[]; format?: (v: number) => string }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  const colors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
  return (
    <div>
      <div className="flex h-3 gap-[2px] overflow-hidden rounded-full bg-[var(--color-bg)]">
        {total > 0 &&
          parts.map((p, i) =>
            p.value > 0 ? (
              <div key={p.label} title={`${p.label}: ${format(p.value)}`} style={{ width: `${(p.value / total) * 100}%`, background: colors[i] }} />
            ) : null
          )}
      </div>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {parts.map((p, i) => (
          <div key={p.label} className="flex items-start gap-2 text-[13.5px]">
            <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: colors[i] }} />
            <div className="min-w-0">
              <div className="text-[var(--color-text-muted)]">{p.label}</div>
              <div className="font-semibold tabular-nums">
                {format(p.value)}
                <span className="ml-1.5 text-[12px] font-normal text-[var(--color-text-muted)]">
                  {total > 0 ? Math.round((p.value / total) * 100) : 0}%
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const MONTHS = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
export function monthLabel(key: string) {
  const [y, m] = key.split("-");
  return `${MONTHS[Number(m) - 1] ?? m} ${String(y).slice(2)}`;
}

/**
 * Столбики по месяцам. Один ряд — золотом и без легенды: подпись над
 * графиком и так говорит, что это. Два ряда (заявки и сделки) — в
 * проверенных категориальных цветах и с легендой.
 */
export function MonthlyBars({
  data,
  series,
  money,
  height = 200,
}: {
  data: Record<string, string | number>[];
  series: { key: string; label: string }[];
  money?: boolean;
  height?: number;
}) {
  const colors = series.length === 1 ? ["var(--color-primary)"] : ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)"];
  const fmt = (v: number) => (money ? formatMoney(v) : String(v));
  const axis = (v: number) => (money ? (v >= 1_000_000 ? `${Math.round(v / 100_000) / 10}м` : v >= 1000 ? `${Math.round(v / 1000)}к` : String(v)) : String(v));
  const rows = data.map((d) => ({ ...d, label: monthLabel(String(d.month)) }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} margin={{ top: 6, right: 0, left: -8, bottom: 0 }} barGap={2} barCategoryGap="22%">
        <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} tickLine={false} axisLine={false} width={44} tickFormatter={axis} allowDecimals={false} />
        <Tooltip
          cursor={{ fill: "var(--color-bg)" }}
          formatter={(value, name) => [fmt(Number(value ?? 0)), String(name)]}
          contentStyle={{
            fontSize: 12,
            borderRadius: 10,
            border: "1px solid var(--color-border)",
            background: "var(--color-surface)",
            color: "var(--color-text)",
          }}
        />
        {series.length > 1 && <Legend iconType="square" iconSize={9} wrapperStyle={{ fontSize: 12 }} />}
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} name={s.label} fill={colors[i]} radius={[4, 4, 0, 0]} maxBarSize={28} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Простая таблица отчёта: горизонтальная прокрутка внутри карточки, а не на всю страницу */
export function Table({
  head,
  rows,
  minWidth = 560,
  empty = "Нет данных за период",
}: {
  head: { label: string; align?: "right" }[];
  rows: { key: string; cells: React.ReactNode[] }[];
  minWidth?: number;
  empty?: string;
}) {
  if (rows.length === 0) return <p className="py-4 text-center text-[13.5px] text-[var(--color-text-muted)]">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13.5px]" style={{ minWidth }}>
        <thead>
          <tr className="border-b border-[var(--color-border)] text-[12.5px] text-[var(--color-text-muted)]">
            {head.map((h) => (
              <th key={h.label} className={cn("pb-2 font-semibold", h.align === "right" ? "text-right" : "text-left")}>
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-b border-[var(--color-border)] last:border-0">
              {row.cells.map((cell, i) => (
                <td key={i} className={cn("py-2.5", head[i]?.align === "right" ? "text-right tabular-nums" : "")}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const pct = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${v}%`);
