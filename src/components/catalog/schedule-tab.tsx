"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAppStore } from "@/lib/store";
import { branches, inventoryCategories } from "@/lib/mock-data";
import { exportRows, isInactiveUnit } from "@/lib/catalog-utils";
import { cn, statusStyles, statusLabels } from "@/lib/utils";
import { ExportButton, FilterSelect, Pagination, SearchInput, paginate } from "./shared";

const DAY = 86400000;
const CELL = 56;

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function toInput(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const weekdays = ["ВС", "ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ"];
const months = ["янв.", "февр.", "март", "апр.", "май", "июнь", "июль", "авг.", "сент.", "окт.", "нояб.", "дек."];

export function ScheduleTab() {
  const inventory = useAppStore((s) => s.inventory);
  const rentals = useAppStore((s) => s.rentals);
  const hydrated = useAppStore((s) => s.hydrated);

  const today = startOfDay(new Date());
  const [from, setFrom] = useState(() => toInput(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [to, setTo] = useState(() => toInput(new Date(today.getFullYear(), today.getMonth() + 1, 0)));
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [branch, setBranch] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);

  const days = useMemo(() => {
    const start = startOfDay(new Date(from));
    const end = startOfDay(new Date(to));
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return [];
    const list: Date[] = [];
    for (let t = start.getTime(); t <= end.getTime() && list.length < 190; t += DAY) list.push(new Date(t));
    return list;
  }, [from, to]);

  const units = useMemo(() => {
    let list = inventory.filter((i) => !isInactiveUnit(i));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((u) => u.name.toLowerCase().includes(q) || u.sku.toLowerCase().includes(q));
    }
    if (category) list = list.filter((u) => u.category === category);
    if (branch) list = list.filter((u) => u.branch === branch);
    return list;
  }, [inventory, search, category, branch]);

  const pageUnits = paginate(units, page, perPage);

  /** Полосы аренд по каждой единице инвентаря в пределах выбранного периода */
  const barsByUnit = useMemo(() => {
    const map = new Map<string, { id: string; number: string; client: string; status: string; from: number; span: number }[]>();
    if (days.length === 0) return map;
    const rangeStart = days[0].getTime();
    const rangeEnd = days[days.length - 1].getTime();

    for (const r of rentals) {
      if (r.status === "cancelled" || r.status === "request") continue;
      const s = startOfDay(new Date(r.startAt ?? r.startDate)).getTime();
      const e = startOfDay(new Date(r.endAt ?? r.endDate)).getTime();
      if (isNaN(s) || isNaN(e)) continue;
      if (e < rangeStart || s > rangeEnd) continue;

      const clampedStart = Math.max(s, rangeStart);
      const clampedEnd = Math.min(e, rangeEnd);
      const fromIdx = Math.round((clampedStart - rangeStart) / DAY);
      const span = Math.max(1, Math.round((clampedEnd - clampedStart) / DAY) + 1);

      for (const line of r.items) {
        if (!line.inventoryItemId) continue;
        const arr = map.get(line.inventoryItemId) ?? [];
        arr.push({ id: r.id, number: r.number, client: r.client?.name ?? "", status: r.status, from: fromIdx, span });
        map.set(line.inventoryItemId, arr);
      }
    }
    return map;
  }, [rentals, days]);

  function handleExport() {
    exportRows(
      units.map((u) => {
        const bars = barsByUnit.get(u.id) ?? [];
        return {
          Инвентарь: u.name,
          Артикул: u.sku,
          Категория: u.category,
          "Пункт проката": u.branch,
          "Аренд в периоде": bars.length,
          Клиенты: bars.map((b) => b.client).join("; "),
        };
      }),
      "График занятости",
      "график-занятости.xlsx"
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 items-center gap-2 sm:flex sm:flex-wrap">
        <SearchInput value={search} onChange={setSearch} className="col-span-2 sm:flex-1" />
        <div className="col-span-2 flex items-center justify-center gap-1.5 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[13px] sm:col-span-1">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="bg-transparent outline-none" />
          <span className="text-[var(--color-text-muted)]">→</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="bg-transparent outline-none" />
        </div>
        <FilterSelect value={category} onChange={setCategory} placeholder="Категория" options={inventoryCategories.map((c) => ({ value: c, label: c }))} />
        <FilterSelect value={branch} onChange={setBranch} placeholder="Пункт проката" options={branches.map((b) => ({ value: b, label: b }))} />
        <div className="col-span-2 sm:ml-auto">
          <ExportButton onClick={handleExport} />
        </div>
      </div>

      <div className="grid grid-cols-2 items-center gap-2 sm:flex sm:flex-wrap">
        <span className="flex items-center gap-1.5 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-[12.5px] font-medium">
          <span className="h-2 w-2 rounded-full bg-[var(--color-primary)]" /> Исправен
        </span>
        <span className="flex items-center gap-1.5 rounded-[10px] border border-[#F8C4C4] bg-[var(--color-surface)] px-3 py-1.5 text-[12.5px] font-medium">
          <span className="h-2 w-2 rounded-full bg-[#EF4444]" /> Сломан
          <span className="rounded-[6px] bg-[#FDECEC] px-1.5 py-[1px] text-[11px] text-[#C0272D]">Не сдаётся в аренду</span>
        </span>
      </div>

      <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] card-shadow">
        <div className="max-h-[65vh] overflow-auto">
          <table className="border-collapse" style={{ minWidth: 260 + days.length * CELL }}>
            <thead className="sticky top-0 z-20">
              <tr>
                <th className="sticky left-0 z-30 w-[260px] min-w-[260px] border-b border-r border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 text-left text-[11.5px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                  Инвентари
                </th>
                {days.map((d) => {
                  const isToday = d.getTime() === today.getTime();
                  const weekend = d.getDay() === 0 || d.getDay() === 6;
                  return (
                    <th
                      key={d.getTime()}
                      style={{ width: CELL, minWidth: CELL }}
                      className={cn(
                        "border-b border-r border-[var(--color-border)] bg-[var(--color-surface)] px-1 py-1.5 text-center",
                        weekend && "bg-[var(--color-bg)]"
                      )}
                    >
                      <div className="text-[10px] font-semibold uppercase text-[var(--color-text-muted)]">{weekdays[d.getDay()]}</div>
                      <div
                        className={cn(
                          "mx-auto mt-0.5 grid h-5 w-5 place-items-center rounded-full text-[11.5px] font-semibold",
                          isToday ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]" : "text-[var(--color-text)]"
                        )}
                      >
                        {d.getDate()}
                      </div>
                      {d.getDate() === 1 && <div className="text-[9.5px] text-[var(--color-text-muted)]">{months[d.getMonth()]}</div>}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {days.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-4 py-10 text-center text-[13px] text-[var(--color-text-muted)]">
                    Укажите корректный период
                  </td>
                </tr>
              ) : pageUnits.length === 0 ? (
                <tr>
                  <td colSpan={days.length + 1} className="px-4 py-10 text-center text-[13px] text-[var(--color-text-muted)]">
                    {hydrated ? "Ничего не найдено" : "Загрузка…"}
                  </td>
                </tr>
              ) : (
                pageUnits.map((u) => {
                  const bars = barsByUnit.get(u.id) ?? [];
                  const broken = u.status === "repair" || u.status === "maintenance";
                  return (
                    <tr key={u.id} className="group">
                      <td className="sticky left-0 z-10 w-[260px] min-w-[260px] border-b border-r border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 group-hover:bg-[var(--color-bg)]">
                        <div className="flex items-center gap-2">
                          <span className={cn("h-2 w-2 shrink-0 rounded-full", broken ? "bg-[#EF4444]" : "bg-[var(--color-primary)]")} />
                          <div className="min-w-0">
                            <Link href={`/catalog/${u.id}`} className="block truncate text-[12.5px] font-medium transition hover:text-[var(--color-primary)]">
                              {u.name}
                            </Link>
                            <div className="text-[11px] text-[var(--color-text-muted)]">{u.sku || "без артикула"}</div>
                          </div>
                        </div>
                      </td>
                      <td colSpan={days.length} className="border-b border-[var(--color-border)] p-0">
                        <div className="relative h-[46px]" style={{ width: days.length * CELL }}>
                          {/* сетка дней */}
                          <div className="absolute inset-0 flex">
                            {days.map((d) => (
                              <div
                                key={d.getTime()}
                                style={{ width: CELL, minWidth: CELL }}
                                className={cn(
                                  "border-r border-[var(--color-border)]",
                                  (d.getDay() === 0 || d.getDay() === 6) && "bg-[var(--color-bg)]/60",
                                  d.getTime() === today.getTime() && "bg-[var(--color-primary-soft)]/40"
                                )}
                              />
                            ))}
                          </div>
                          {/* полосы аренд */}
                          {bars.map((b, i) => {
                            const st = statusStyles[b.status as keyof typeof statusStyles] ?? statusStyles.booked;
                            return (
                              <Link
                                key={`${b.id}_${i}`}
                                href={`/rentals/${b.id}`}
                                title={`${b.client} · ${statusLabels[b.status as keyof typeof statusLabels] ?? b.status}`}
                                style={{ left: b.from * CELL + 3, width: b.span * CELL - 6 }}
                                className={cn(
                                  "absolute top-[7px] flex h-[32px] items-center overflow-hidden rounded-[6px] border px-2 text-[11.5px] font-medium",
                                  st.bg,
                                  st.text,
                                  st.border
                                )}
                              >
                                <span className="truncate">{b.client || `№${b.number}`}</span>
                              </Link>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination total={units.length} page={page} perPage={perPage} onPage={setPage} onPerPage={setPerPage} />
    </div>
  );
}
