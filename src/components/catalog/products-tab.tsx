"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAppStore } from "@/lib/store";
import { branches, inventoryCategories, inventoryStatusLabels } from "@/lib/mock-data";
import { groupProducts, isInactiveUnit, exportRows, ProductGroup } from "@/lib/catalog-utils";
import { cn, formatMoney } from "@/lib/utils";
import { ChevronDown, ChevronRight, Tag } from "lucide-react";
import { Checkbox, EmptyRow, ExportButton, FilterSelect, Pagination, Pill, SearchInput, StatBar, TableCard, Th, paginate } from "./shared";

type SortKey = "name" | "category" | "sku" | "free";

export function ProductsTab({ showInactive }: { showInactive: boolean }) {
  const inventory = useAppStore((s) => s.inventory);
  const rentals = useAppStore((s) => s.rentals);
  const hydrated = useAppStore((s) => s.hydrated);

  const [search, setSearch] = useState("");
  const [branch, setBranch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [onlyFree, setOnlyFree] = useState(false);
  const [sort, setSort] = useState<SortKey>("name");
  const [dir, setDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Активные единицы — то, что реально сдаётся. Украденные и списанные показываются отдельной кнопкой.
  const scope = useMemo(
    () => inventory.filter((i) => (showInactive ? isInactiveUnit(i) : !isInactiveUnit(i))),
    [inventory, showInactive]
  );

  const groups = useMemo(() => groupProducts(scope, rentals), [scope, rentals]);

  const filtered = useMemo(() => {
    let list = groups;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (g) =>
          g.name.toLowerCase().includes(q) ||
          g.sku.toLowerCase().includes(q) ||
          g.units.some((u) => u.sku.toLowerCase().includes(q) || (u.serialNumber ?? "").toLowerCase().includes(q))
      );
    }
    if (branch) list = list.filter((g) => g.units.some((u) => u.branch === branch));
    if (category) list = list.filter((g) => g.category === category);
    if (status) list = list.filter((g) => g.units.some((u) => u.status === status));
    if (onlyFree) list = list.filter((g) => g.free > 0);

    const sorted = [...list].sort((a, b) => {
      const k =
        sort === "free"
          ? a.free - b.free
          : sort === "category"
            ? a.category.localeCompare(b.category, "ru")
            : sort === "sku"
              ? a.sku.localeCompare(b.sku, "ru")
              : a.name.localeCompare(b.name, "ru");
      return dir === "asc" ? k : -k;
    });
    return sorted;
  }, [groups, search, branch, category, status, onlyFree, sort, dir]);

  const pageItems = paginate(filtered, page, perPage);

  const totals = useMemo(() => {
    const t = { units: 0, free: 0, booked: 0, rented: 0, broken: 0, repair: 0, inactive: 0 };
    for (const g of groups) {
      t.units += g.total;
      t.free += g.free;
      t.booked += g.booked;
      t.rented += g.rented;
      t.broken += g.broken;
      t.repair += g.repair;
      t.inactive += g.inactive;
    }
    return t;
  }, [groups]);

  const pct = (n: number) => (totals.units ? `${Math.round((n / totals.units) * 100)}%` : "0%");

  function toggleSort(key: SortKey) {
    if (sort === key) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSort(key);
      setDir("asc");
    }
  }

  function toggleExpand(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleExport() {
    exportRows(
      filtered.map((g) => ({
        Название: g.name,
        Категория: g.category,
        Артикул: g.sku,
        Всего: g.total,
        Свободно: g.free,
        Забронировано: g.booked,
        "В аренде": g.rented,
        Неисправно: g.broken,
        "На ремонте": g.repair,
        "Цена, ₸": g.price,
      })),
      "Продукты",
      "продукты.xlsx"
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 items-center gap-2 sm:flex sm:flex-wrap">
        <SearchInput value={search} onChange={setSearch} className="col-span-2 sm:flex-1" />
        <FilterSelect value={branch} onChange={setBranch} placeholder="Пункт проката" options={branches.map((b) => ({ value: b, label: b }))} />
        <FilterSelect value={category} onChange={setCategory} placeholder="Категория" options={inventoryCategories.map((c) => ({ value: c, label: c }))} />
        <FilterSelect
          value={status}
          onChange={setStatus}
          placeholder="Тип продуктов"
          options={Object.entries(inventoryStatusLabels).map(([k, v]) => ({ value: k, label: v }))}
        />
        <Checkbox checked={onlyFree} onChange={setOnlyFree} label="Только свободные" />
        <div className="col-span-2 sm:ml-auto">
          <ExportButton onClick={handleExport} />
        </div>
      </div>

      <StatBar
        items={[
          { value: groups.length, label: "Продукт" },
          { value: totals.units, label: "Кол-во", pct: "100%" },
          { value: totals.free, label: "Свободно", pct: pct(totals.free) },
          { value: totals.booked, label: "Забронировано", pct: pct(totals.booked) },
          { value: totals.rented, label: "В аренде", pct: pct(totals.rented) },
          { value: totals.broken, label: "Неисправно", pct: pct(totals.broken) },
          { value: totals.repair, label: "На ремонте", pct: pct(totals.repair) },
          { value: totals.inactive, label: "Списано / украдено", pct: pct(totals.inactive) },
        ]}
      />

      <TableCard>
        <table className="w-full border-collapse">
          <thead className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
            <tr>
              <Th className="w-10" />
              <Th sortable active={sort === "name"} dir={dir} onSort={() => toggleSort("name")}>
                Название
              </Th>
              <Th sortable active={sort === "category"} dir={dir} onSort={() => toggleSort("category")}>
                Категория
              </Th>
              <Th sortable active={sort === "sku"} dir={dir} onSort={() => toggleSort("sku")}>
                Артикул
              </Th>
              <Th sortable active={sort === "free"} dir={dir} onSort={() => toggleSort("free")}>
                Доступность
              </Th>
              <Th>Неисправно</Th>
              <Th className="text-right">Цена(-ы)</Th>
            </tr>
          </thead>
          <tbody>
            {pageItems.length === 0 ? (
              <EmptyRow
                colSpan={7}
                text={!hydrated ? "Загрузка…" : showInactive ? "Нет списанных и украденных единиц" : "Ничего не найдено"}
              />
            ) : (
              pageItems.map((g) => (
                <ProductRow key={g.key} group={g} expanded={expanded.has(g.key)} onToggle={() => toggleExpand(g.key)} />
              ))
            )}
          </tbody>
        </table>
      </TableCard>

      <Pagination total={filtered.length} page={page} perPage={perPage} onPage={setPage} onPerPage={setPerPage} />
    </div>
  );
}

function ProductRow({ group, expanded, onToggle }: { group: ProductGroup; expanded: boolean; onToggle: () => void }) {
  const single = group.units.length === 1;
  const brokenTotal = group.broken + group.repair;

  return (
    <>
      <tr className="border-b border-[var(--color-border)] transition last:border-0 hover:bg-[var(--color-bg)]">
        <td className="px-4 py-3">
          {single ? (
            <span className="block h-4 w-4" />
          ) : (
            <button onClick={onToggle} className="grid h-5 w-5 place-items-center text-[var(--color-text-muted)] transition hover:text-[var(--color-primary)]">
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          )}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-[10px] bg-[var(--color-bg)]">
              {group.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={group.photoUrl} alt={group.name} className="h-full w-full object-cover" />
              ) : (
                <Tag className="h-4 w-4 text-[var(--color-text-muted)]" />
              )}
            </div>
            {single ? (
              <Link href={`/catalog/${group.units[0].id}`} className="text-[13.5px] font-semibold transition hover:text-[var(--color-primary)]">
                {group.name}
              </Link>
            ) : (
              <button onClick={onToggle} className="text-left text-[13.5px] font-semibold transition hover:text-[var(--color-primary)]">
                {group.name}
                <span className="ml-2 text-[11.5px] font-medium text-[var(--color-text-muted)]">{group.total} ед.</span>
              </button>
            )}
          </div>
        </td>
        <td className="px-4 py-3 text-[13px] text-[var(--color-text-muted)]">{group.category || "—"}</td>
        <td className="px-4 py-3 text-[13px] text-[var(--color-text-muted)]">{group.sku || "—"}</td>
        <td className="px-4 py-3">
          <Pill tone={group.free > 0 ? "green" : "red"}>
            {group.free}/{group.total} Свободно
          </Pill>
        </td>
        <td className="px-4 py-3 text-[13px]">{brokenTotal > 0 ? <Pill tone="amber">{brokenTotal}</Pill> : <span className="text-[var(--color-text-muted)]">—</span>}</td>
        <td className="px-4 py-3 text-right text-[13.5px] font-semibold">{formatMoney(group.price)}</td>
      </tr>

      {expanded &&
        group.units.map((u) => (
          <tr key={u.id} className="border-b border-[var(--color-border)] bg-[var(--color-bg)]/60 last:border-0">
            <td />
            <td className="px-4 py-2 pl-16">
              <Link href={`/catalog/${u.id}`} className="text-[12.5px] font-medium transition hover:text-[var(--color-primary)]">
                {u.serialNumber ? `S/N ${u.serialNumber}` : u.name}
              </Link>
            </td>
            <td className="px-4 py-2 text-[12px] text-[var(--color-text-muted)]">{u.branch || "—"}</td>
            <td className="px-4 py-2 text-[12px] text-[var(--color-text-muted)]">{u.sku || "—"}</td>
            <td className="px-4 py-2">
              <span
                className={cn(
                  "text-[12px] font-medium",
                  u.status === "available" ? "text-[#1C8A46]" : u.status === "rented" ? "text-[#B8620A]" : "text-[var(--color-text-muted)]"
                )}
              >
                {inventoryStatusLabels[u.status]}
              </span>
            </td>
            <td />
            <td className="px-4 py-2 text-right text-[12.5px]">{formatMoney(u.rentalPricePerDay)}</td>
          </tr>
        ))}
    </>
  );
}
