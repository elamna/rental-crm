"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAppStore } from "@/lib/store";
import { useAuth } from "@/components/auth/auth-provider";
import { InventoryItem } from "@/lib/types";
import { inventoryCategories, inventoryStatusLabels } from "@/lib/mock-data";
import { exportRows, isInactiveUnit, lastCheckByItem, lastRentalByItem } from "@/lib/catalog-utils";
import { cn, formatDateTimeDisplay } from "@/lib/utils";
import { CheckCircle2, Tag, User, X } from "lucide-react";
import { EmptyRow, ExportButton, FilterSelect, Pagination, Pill, SearchInput, TableCard, Th, paginate } from "./shared";

type Condition = "all" | "ok" | "broken" | "unchecked";

const subTabs = [
  { key: "list", label: "Список для проверки" },
  { key: "history", label: "История проверок" },
] as const;

export function InventoryCheckTab() {
  const inventory = useAppStore((s) => s.inventory);
  const rentals = useAppStore((s) => s.rentals);
  const checks = useAppStore((s) => s.inventoryChecks);
  const hydrated = useAppStore((s) => s.hydrated);

  const [sub, setSub] = useState<(typeof subTabs)[number]["key"]>("list");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [condition, setCondition] = useState<Condition>("all");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [checkItem, setCheckItem] = useState<InventoryItem | null>(null);

  const lastChecks = useMemo(() => lastCheckByItem(checks), [checks]);
  const lastRentals = useMemo(() => lastRentalByItem(rentals), [rentals]);

  const units = useMemo(() => inventory.filter((i) => !isInactiveUnit(i)), [inventory]);

  const counts = useMemo(() => {
    let ok = 0;
    let broken = 0;
    let unchecked = 0;
    for (const u of units) {
      const c = lastChecks.get(u.id);
      if (!c) unchecked += 1;
      else if (c.condition === "ok") ok += 1;
      else broken += 1;
    }
    return { ok, broken, unchecked };
  }, [units, lastChecks]);

  const filtered = useMemo(() => {
    let list = units;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((u) => u.name.toLowerCase().includes(q) || u.sku.toLowerCase().includes(q));
    }
    if (category) list = list.filter((u) => u.category === category);
    if (condition !== "all") {
      list = list.filter((u) => {
        const c = lastChecks.get(u.id);
        if (condition === "unchecked") return !c;
        return c?.condition === condition;
      });
    }
    return list;
  }, [units, search, category, condition, lastChecks]);

  const pageItems = paginate(filtered, page, perPage);

  const historyRows = useMemo(() => {
    const byId = new Map(inventory.map((i) => [i.id, i]));
    let list = checks.map((c) => ({ check: c, item: byId.get(c.inventoryItemId) }));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((r) => (r.item?.name ?? "").toLowerCase().includes(q) || (r.item?.sku ?? "").toLowerCase().includes(q));
    }
    return list;
  }, [checks, inventory, search]);

  const historyPage = paginate(historyRows, page, perPage);

  function handleExport() {
    if (sub === "history") {
      exportRows(
        historyRows.map((r) => ({
          Инвентарь: r.item?.name ?? "—",
          Артикул: r.item?.sku ?? "—",
          Состояние: r.check.condition === "ok" ? "Исправен" : "Сломан",
          Проверял: r.check.checkedByName,
          Комментарий: r.check.comment ?? "",
          Дата: formatDateTimeDisplay(r.check.createdAt),
        })),
        "История проверок",
        "история-проверок.xlsx"
      );
      return;
    }
    exportRows(
      filtered.map((u) => {
        const c = lastChecks.get(u.id);
        return {
          Инвентарь: u.name,
          Артикул: u.sku,
          Статус: inventoryStatusLabels[u.status],
          Состояние: c ? (c.condition === "ok" ? "Исправен" : "Сломан") : "Не проверено",
          Проверял: c?.checkedByName ?? "",
          "Последняя аренда": lastRentals.get(u.id)?.number ?? "",
          "Последняя проверка": c ? formatDateTimeDisplay(c.createdAt) : "",
        };
      }),
      "Инвентаризация",
      "инвентаризация.xlsx"
    );
  }

  return (
    <div className="space-y-4">
      <div className="inline-flex gap-1 rounded-[10px] bg-[var(--color-bg)] p-1">
        {subTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setSub(t.key);
              setPage(1);
            }}
            className={cn(
              "rounded-[8px] px-3.5 py-1.5 text-[12.5px] font-semibold transition",
              sub === t.key ? "bg-[var(--color-surface)] text-[var(--color-primary)] shadow-sm" : "text-[var(--color-text-muted)]"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 items-center gap-2 sm:flex sm:flex-wrap">
        <SearchInput value={search} onChange={setSearch} className="col-span-2 sm:flex-1" />
        {sub === "list" && (
          <FilterSelect value={category} onChange={setCategory} placeholder="Категория" options={inventoryCategories.map((c) => ({ value: c, label: c }))} />
        )}
        <div className="col-span-2 sm:ml-auto">
          <ExportButton onClick={handleExport} />
        </div>
      </div>

      {sub === "list" && (
        <div className="inline-flex flex-wrap gap-1 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] p-1 card-shadow">
          {([
            { key: "all", label: "Все", count: units.length },
            { key: "ok", label: "Исправен", count: counts.ok },
            { key: "broken", label: "Сломан", count: counts.broken },
            { key: "unchecked", label: "Не проверено", count: counts.unchecked },
          ] as { key: Condition; label: string; count: number }[]).map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setCondition(t.key);
                setPage(1);
              }}
              className={cn(
                "flex items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-[12.5px] font-semibold transition",
                condition === t.key ? "bg-[var(--color-bg)] text-[var(--color-text)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
              )}
            >
              {t.label}
              <span className="rounded-full bg-[var(--color-primary-soft)] px-1.5 py-[1px] text-[11px] text-[var(--color-primary)]">{t.count}</span>
            </button>
          ))}
        </div>
      )}

      {sub === "list" ? (
        <TableCard>
          <table className="w-full border-collapse">
            <thead className="border-b border-[var(--color-border)]">
              <tr>
                <Th>Инвентарь</Th>
                <Th>Артикул</Th>
                <Th>Статус</Th>
                <Th>Состояние</Th>
                <Th>Проверял</Th>
                <Th>Последняя аренда</Th>
                <Th>Последняя проверка</Th>
                <Th className="w-24" />
              </tr>
            </thead>
            <tbody>
              {pageItems.length === 0 ? (
                <EmptyRow colSpan={8} text={!hydrated ? "Загрузка…" : "Ничего не найдено"} />
              ) : (
                pageItems.map((u) => {
                  const c = lastChecks.get(u.id);
                  const rental = lastRentals.get(u.id);
                  return (
                    <tr key={u.id} className="border-b border-[var(--color-border)] transition last:border-0 hover:bg-[var(--color-bg)]">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] bg-[var(--color-bg)]">
                            <Tag className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
                          </div>
                          <Link href={`/catalog/${u.id}`} className="text-[13px] font-semibold transition hover:text-[var(--color-primary)]">
                            {u.name}
                          </Link>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[12.5px] text-[var(--color-text-muted)]">#{u.sku || "—"}</td>
                      <td className="px-4 py-3">
                        <Pill tone={u.status === "available" ? "green" : u.status === "rented" ? "amber" : "red"}>
                          {inventoryStatusLabels[u.status]}
                        </Pill>
                      </td>
                      <td className="px-4 py-3">
                        {c ? (
                          <Pill tone={c.condition === "ok" ? "violet" : "red"}>{c.condition === "ok" ? "Исправен" : "Сломан"}</Pill>
                        ) : (
                          <Pill tone="grey">Не проверено</Pill>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[12.5px] text-[var(--color-text-muted)]">
                        {c ? (
                          <span className="flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5" />
                            {c.checkedByName || "—"}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-[12.5px]">
                        {rental ? (
                          <Link href={`/rentals/${rental.id}`} className="text-[var(--color-primary)] underline-offset-2 hover:underline">
                            Аренда №{rental.number}
                          </Link>
                        ) : (
                          <span className="text-[var(--color-text-muted)]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[12.5px] text-[#C0272D]">{c ? formatDateTimeDisplay(c.createdAt) : "—"}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setCheckItem(u)}
                          className="rounded-[8px] border border-[var(--color-border)] px-2.5 py-1 text-[12px] font-semibold text-[var(--color-text-muted)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                        >
                          Проверить
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </TableCard>
      ) : (
        <TableCard>
          <table className="w-full border-collapse">
            <thead className="border-b border-[var(--color-border)]">
              <tr>
                <Th>Инвентарь</Th>
                <Th>Артикул</Th>
                <Th>Состояние</Th>
                <Th>Проверял</Th>
                <Th>Комментарий</Th>
                <Th>Дата</Th>
              </tr>
            </thead>
            <tbody>
              {historyPage.length === 0 ? (
                <EmptyRow colSpan={6} text={!hydrated ? "Загрузка…" : "Проверок ещё не было"} />
              ) : (
                historyPage.map(({ check, item }) => (
                  <tr key={check.id} className="border-b border-[var(--color-border)] transition last:border-0 hover:bg-[var(--color-bg)]">
                    <td className="px-4 py-3 text-[13px] font-medium">{item?.name ?? "удалённая позиция"}</td>
                    <td className="px-4 py-3 text-[12.5px] text-[var(--color-text-muted)]">#{item?.sku || "—"}</td>
                    <td className="px-4 py-3">
                      <Pill tone={check.condition === "ok" ? "violet" : "red"}>{check.condition === "ok" ? "Исправен" : "Сломан"}</Pill>
                    </td>
                    <td className="px-4 py-3 text-[12.5px] text-[var(--color-text-muted)]">{check.checkedByName || "—"}</td>
                    <td className="px-4 py-3 text-[12.5px] text-[var(--color-text-muted)]">{check.comment || "—"}</td>
                    <td className="px-4 py-3 text-[12.5px] text-[var(--color-text-muted)]">{formatDateTimeDisplay(check.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </TableCard>
      )}

      <Pagination
        total={sub === "list" ? filtered.length : historyRows.length}
        page={page}
        perPage={perPage}
        onPage={setPage}
        onPerPage={setPerPage}
      />

      {checkItem && <CheckModal item={checkItem} onClose={() => setCheckItem(null)} />}
    </div>
  );
}

function CheckModal({ item, onClose }: { item: InventoryItem; onClose: () => void }) {
  const addInventoryCheck = useAppStore((s) => s.addInventoryCheck);
  const { user } = useAuth();
  const [condition, setCondition] = useState<"ok" | "broken">("ok");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await addInventoryCheck({
      inventoryItemId: item.id,
      condition,
      checkedByName: user?.name ?? "—",
      comment: comment.trim() || undefined,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-[20px] bg-[var(--color-surface)] p-4 pb-8 shadow-xl safe-bottom sm:rounded-[var(--radius-card)] sm:p-6 sm:pb-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="font-display text-[17px] font-bold">Проверка инвентаря</h2>
            <p className="text-[12.5px] text-[var(--color-text-muted)]">
              {item.name} · #{item.sku || "без артикула"}
            </p>
          </div>
          <button onClick={onClose} className="text-[var(--color-text-muted)] transition hover:text-[#C0272D]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { key: "ok", label: "Исправен" },
              { key: "broken", label: "Сломан" },
            ] as const
          ).map((o) => (
            <button
              key={o.key}
              onClick={() => setCondition(o.key)}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-[10px] border py-2.5 text-[13px] font-semibold transition",
                condition === o.key
                  ? o.key === "ok"
                    ? "border-[#1C8A46] bg-[#EAF7EE] text-[#1C8A46]"
                    : "border-[#C0272D] bg-[#FDECEC] text-[#C0272D]"
                  : "border-[var(--color-border)] text-[var(--color-text-muted)]"
              )}
            >
              <CheckCircle2 className="h-4 w-4" /> {o.label}
            </button>
          ))}
        </div>

        {condition === "broken" && item.status === "available" && (
          <p className="mt-3 rounded-[10px] bg-[#FFF4E5] px-3 py-2 text-[12.5px] text-[#B8620A]">
            Свободная единица будет переведена в статус «Требует ремонта» и перестанет попадать в новые аренды.
          </p>
        )}

        <label className="mt-4 block">
          <span className="mb-1.5 block text-[12.5px] font-medium text-[var(--color-text-muted)]">Комментарий</span>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} className="crm-input" />
        </label>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-[10px] border border-[var(--color-border)] px-4 py-2.5 text-[13.5px] font-semibold text-[var(--color-text-muted)]">
            Отмена
          </button>
          <button
            disabled={saving}
            onClick={save}
            className="rounded-[10px] bg-[var(--color-primary)] px-5 py-2.5 text-[13.5px] font-semibold text-[var(--color-on-primary)] transition hover:bg-[var(--color-primary-hover)] disabled:opacity-40"
          >
            {saving ? "Сохранение…" : "Записать проверку"}
          </button>
        </div>
      </div>
    </div>
  );
}
