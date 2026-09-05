"use client";

import { useMemo, useState } from "react";
import { useAppStore } from "@/lib/store";
import { Kit } from "@/lib/types";
import { inventoryCategories } from "@/lib/mock-data";
import { exportRows, groupProducts, kitAvailability, kitPrice, revenueByName } from "@/lib/catalog-utils";
import { formatMoney } from "@/lib/utils";
import { Image as ImageIcon, Pencil, Trash2 } from "lucide-react";
import { EmptyRow, ExportButton, FilterSelect, Pagination, Pill, SearchInput, StatBar, TableCard, Th, paginate } from "./shared";
import { KitModal } from "./kit-modal";

export function KitsTab({ editing, onCloseEditor }: { editing: boolean; onCloseEditor: () => void }) {
  const kits = useAppStore((s) => s.kits);
  const inventory = useAppStore((s) => s.inventory);
  const rentals = useAppStore((s) => s.rentals);
  const deleteKit = useAppStore((s) => s.deleteKit);
  const hydrated = useAppStore((s) => s.hydrated);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [editKit, setEditKit] = useState<Kit | null>(null);

  const products = useMemo(() => groupProducts(inventory, rentals), [inventory, rentals]);

  const filtered = useMemo(() => {
    let list = kits;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((k) => k.name.toLowerCase().includes(q) || k.lines.some((l) => l.name.toLowerCase().includes(q)));
    }
    if (category) list = list.filter((k) => k.category === category);
    return list;
  }, [kits, search, category]);

  const pageItems = paginate(filtered, page, perPage);

  const freeCount = kits.filter((k) => {
    const a = kitAvailability(k, products);
    return a.free === null || a.free > 0;
  }).length;
  const revenue = kits.reduce((s, k) => s + revenueByName(rentals, k.name), 0);

  function handleExport() {
    exportRows(
      filtered.map((k) => ({
        Название: k.name,
        Категория: k.category,
        "Кол-во позиций": k.lines.length,
        "Цена, ₸": kitPrice(k),
        Состав: k.lines.map((l) => `${l.name} ×${l.qty}`).join("; "),
      })),
      "Комплекты",
      "комплекты.xlsx"
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} className="flex-1" />
        <FilterSelect value={category} onChange={setCategory} placeholder="Категория" options={inventoryCategories.map((c) => ({ value: c, label: c }))} />
        <div className="ml-auto">
          <ExportButton onClick={handleExport} />
        </div>
      </div>

      <StatBar
        items={[
          { value: kits.length, label: "Кол-во комплектов" },
          { value: freeCount, label: "Свободно", pct: kits.length ? `${Math.round((freeCount / kits.length) * 100)}%` : "0%" },
          { value: formatMoney(revenue), label: "Общая выручка" },
        ]}
      />

      <TableCard>
        <table className="w-full border-collapse">
          <thead className="border-b border-[var(--color-border)]">
            <tr>
              <Th>Название</Th>
              <Th>Категория</Th>
              <Th>Кол-во позиций</Th>
              <Th>Цены</Th>
              <Th>Аренда</Th>
              <Th className="w-20" />
            </tr>
          </thead>
          <tbody>
            {pageItems.length === 0 ? (
              <EmptyRow colSpan={6} text={!hydrated ? "Загрузка…" : "Комплектов пока нет — добавьте первый"} />
            ) : (
              pageItems.map((k) => {
                const avail = kitAvailability(k, products);
                return (
                  <tr key={k.id} className="border-b border-[var(--color-border)] transition last:border-0 hover:bg-[var(--color-bg)]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-[10px] bg-[var(--color-bg)]">
                          {k.photoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={k.photoUrl} alt={k.name} className="h-full w-full object-cover" />
                          ) : (
                            <ImageIcon className="h-4 w-4 text-[var(--color-text-muted)]" />
                          )}
                        </div>
                        <button onClick={() => setEditKit(k)} className="text-left text-[13.5px] font-semibold transition hover:text-[var(--color-primary)]">
                          {k.name}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[var(--color-text-muted)]">{k.category || "—"}</td>
                    <td className="px-4 py-3 text-[13px]">{k.lines.length}</td>
                    <td className="px-4 py-3">
                      <span className="inline-block rounded-[8px] bg-[var(--color-primary-soft)] px-2.5 py-1 text-[12px] font-semibold text-[var(--color-primary)]">
                        {formatMoney(kitPrice(k))}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {avail.free === null ? (
                        <Pill tone="green">∞ Свободно</Pill>
                      ) : (
                        <Pill tone={avail.free > 0 ? "green" : "red"}>
                          {avail.free}/{avail.total} Свободно
                        </Pill>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setEditKit(k)} className="grid h-7 w-7 place-items-center rounded-[8px] text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg)] hover:text-[var(--color-primary)]">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Удалить комплект «${k.name}»?`)) deleteKit(k.id);
                          }}
                          className="grid h-7 w-7 place-items-center rounded-[8px] text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg)] hover:text-[#C0272D]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </TableCard>

      <Pagination total={filtered.length} page={page} perPage={perPage} onPage={setPage} onPerPage={setPerPage} />

      {editing && <KitModal onClose={onCloseEditor} />}
      {editKit && <KitModal kit={editKit} onClose={() => setEditKit(null)} />}
    </div>
  );
}
