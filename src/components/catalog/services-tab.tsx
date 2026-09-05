"use client";

import { useMemo, useState } from "react";
import { useAppStore } from "@/lib/store";
import { Service } from "@/lib/types";
import { exportRows, formatTariffs, revenueByName, servicePrice, usageCountByName } from "@/lib/catalog-utils";
import { formatMoney } from "@/lib/utils";
import { Pencil, Trash2, Wrench } from "lucide-react";
import { EmptyRow, ExportButton, Pagination, SearchInput, StatBar, TableCard, Th, paginate } from "./shared";
import { ServiceModal } from "./service-modal";

export function ServicesTab({ editing, onCloseEditor }: { editing: boolean; onCloseEditor: () => void }) {
  const services = useAppStore((s) => s.services);
  const rentals = useAppStore((s) => s.rentals);
  const deleteService = useAppStore((s) => s.deleteService);
  const hydrated = useAppStore((s) => s.hydrated);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [editService, setEditService] = useState<Service | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return services;
    const q = search.trim().toLowerCase();
    return services.filter((s) => s.name.toLowerCase().includes(q));
  }, [services, search]);

  const pageItems = paginate(filtered, page, perPage);

  const { revenue, uses } = useMemo(() => {
    let revenue = 0;
    let uses = 0;
    for (const s of services) {
      revenue += revenueByName(rentals, s.name);
      uses += usageCountByName(rentals, s.name);
    }
    return { revenue, uses };
  }, [services, rentals]);

  const avgCheck = uses ? Math.round(revenue / uses) : 0;

  function handleExport() {
    exportRows(
      filtered.map((s) => ({
        Название: s.name,
        Тарифы: formatTariffs(s),
        "Цена, ₸": servicePrice(s),
        "Использований в арендах": usageCountByName(rentals, s.name),
        "Выручка, ₸": revenueByName(rentals, s.name),
      })),
      "Услуги",
      "услуги.xlsx"
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} className="flex-1" />
        <div className="ml-auto">
          <ExportButton onClick={handleExport} />
        </div>
      </div>

      <StatBar
        items={[
          { value: services.length, label: "Кол-во услуг" },
          { value: formatMoney(revenue), label: "Общая выручка" },
          { value: formatMoney(avgCheck), label: "Средний чек" },
        ]}
      />

      <TableCard>
        <table className="w-full border-collapse">
          <thead className="border-b border-[var(--color-border)]">
            <tr>
              <Th>Название</Th>
              <Th>Использований</Th>
              <Th className="text-right">Цена тарифов</Th>
              <Th className="w-20" />
            </tr>
          </thead>
          <tbody>
            {pageItems.length === 0 ? (
              <EmptyRow colSpan={4} text={!hydrated ? "Загрузка…" : "Услуг пока нет — создайте первую"} />
            ) : (
              pageItems.map((s) => (
                <tr key={s.id} className="border-b border-[var(--color-border)] transition last:border-0 hover:bg-[var(--color-bg)]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-[var(--color-bg)]">
                        <Wrench className="h-4 w-4 text-[var(--color-text-muted)]" />
                      </div>
                      <button onClick={() => setEditService(s)} className="text-left text-[13.5px] font-semibold transition hover:text-[var(--color-primary)]">
                        {s.name}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[13px] text-[var(--color-text-muted)]">{usageCountByName(rentals, s.name)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-baseline justify-end gap-3">
                      <span className="text-[12.5px] text-[var(--color-text-muted)]">{formatTariffs(s) || "тариф не задан"}</span>
                      <span className="min-w-[90px] border-b border-dashed border-[var(--color-border)] text-right text-[13.5px] font-semibold">
                        {formatMoney(servicePrice(s))}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setEditService(s)} className="grid h-7 w-7 place-items-center rounded-[8px] text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg)] hover:text-[var(--color-primary)]">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Удалить услугу «${s.name}»?`)) deleteService(s.id);
                        }}
                        className="grid h-7 w-7 place-items-center rounded-[8px] text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg)] hover:text-[#C0272D]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </TableCard>

      <Pagination total={filtered.length} page={page} perPage={perPage} onPage={setPage} onPerPage={setPerPage} />

      {editing && <ServiceModal onClose={onCloseEditor} />}
      {editService && <ServiceModal service={editService} onClose={() => setEditService(null)} />}
    </div>
  );
}
