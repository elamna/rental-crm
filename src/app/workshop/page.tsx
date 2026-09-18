"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAppStore } from "@/lib/store";
import { InventoryItem, WorkshopLine, WorkshopReason, WorkshopStatus, WorkshopTicket } from "@/lib/types";
import { cn, formatMoney } from "@/lib/utils";
import { inventoryStatusLabels } from "@/lib/mock-data";
import { ClientTypeFilterToggle } from "@/components/ui/client-type-filter";
import { matchesClientType, type ClientTypeFilter } from "@/lib/client-type";
import { AlertTriangle, Archive, CheckCircle2, Circle, Clock3, Plus, Search, Settings2, X, Trash2, PackageSearch } from "lucide-react";

const columns: { key: WorkshopStatus; label: string; dot: string; icon: React.ElementType }[] = [
  { key: "new", label: "Новая", dot: "bg-[#8B8F98]", icon: Circle },
  { key: "servicing", label: "На обслуживании", dot: "bg-[#2B5FD9]", icon: Settings2 },
  { key: "in_progress", label: "В ремонте", dot: "bg-[#F59E0B]", icon: Clock3 },
  // Ждём деталь: ремонт начат, но продолжить нельзя. Отдельная колонка, чтобы
  // такие инструменты не путали с теми, над которыми мастер работает сейчас
  { key: "waiting_parts", label: "Ждём запчасти", dot: "bg-[#A855F7]", icon: PackageSearch },
  { key: "done", label: "Готово", dot: "bg-[#34C987]", icon: CheckCircle2 },
  { key: "archived", label: "Архив", dot: "bg-[#8B8F98]", icon: Archive },
];

const reasonLabels: Record<WorkshopReason, string> = {
  service: "Обслуживание",
  maintenance: "Диагностика",
  repair: "Ремонт",
};

export default function WorkshopPage() {
  const tickets = useAppStore((s) => s.workshopTickets);
  const inventory = useAppStore((s) => s.inventory);
  const rentals = useAppStore((s) => s.rentals);
  const addWorkshopTicket = useAppStore((s) => s.addWorkshopTicket);
  const updateWorkshopTicket = useAppStore((s) => s.updateWorkshopTicket);
  const deleteWorkshopTicket = useAppStore((s) => s.deleteWorkshopTicket);
  const [showNew, setShowNew] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [reasonFilter, setReasonFilter] = useState<WorkshopReason | "all">("all");
  // Архив копится годами и на доске не нужен: открывается по кнопке
  const [showArchive, setShowArchive] = useState(false);
  const [clientType, setClientType] = useState<ClientTypeFilter>("all");

  /**
   * Чей инструмент чиним — узнаём по аренде, из которой он пришёл. У заявок
   * без аренды (плановое ТО, поломка на складе) клиента нет, поэтому при
   * отборе «физлица» или «юрлица» они не показываются.
   */
  const clientTypeByRental = useMemo(
    () => new Map(rentals.map((r) => [r.id, r.client?.type])),
    [rentals]
  );

  const selected = tickets.find((ticket) => ticket.id === selectedId) ?? tickets[0];
  const activeTickets = tickets.filter((ticket) => ticket.status !== "archived");

  /** Инструменты с незакрытой заявкой — чтобы не заводить вторую по тому же */
  const busyItemIds = useMemo(
    () => new Set(activeTickets.map((ticket) => ticket.inventoryItemId)),
    [activeTickets]
  );

  /**
   * Что показывать на доске.
   *
   * При шестидесяти заявках доска без отбора нечитаема: приёмщик ищет свой
   * станок глазами по всем колонкам. Поиск идёт по инструменту, номеру заявки
   * и названию — тому, что человек помнит.
   */
  const visibleColumns = useMemo(
    () => (showArchive ? columns : columns.filter((column) => column.key !== "archived")),
    [showArchive]
  );

  const visibleTickets = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tickets.filter((ticket) => {
      if (!showArchive && ticket.status === "archived") return false;
      if (reasonFilter !== "all" && ticket.reason !== reasonFilter) return false;
      if (clientType !== "all") {
        if (!ticket.sourceRentalId || !clientTypeByRental.has(ticket.sourceRentalId)) return false;
        if (!matchesClientType(clientTypeByRental.get(ticket.sourceRentalId), clientType)) return false;
      }
      if (!q) return true;
      const haystack = `${ticket.inventoryItem?.name ?? ""} ${ticket.number} ${ticket.title} ${ticket.inventoryItem?.sku ?? ""}`.toLowerCase();
      return q.split(/\s+/).every((word) => haystack.includes(word));
    });
  }, [tickets, query, reasonFilter, showArchive, clientType, clientTypeByRental]);

  const filtering = query.trim() !== "" || reasonFilter !== "all" || clientType !== "all";
  const brokenByItem = useMemo(() => {
    const map = new Map<string, { item: InventoryItem | undefined; count: number; cost: number }>();
    for (const ticket of tickets) {
      const current = map.get(ticket.inventoryItemId) ?? { item: ticket.inventoryItem, count: 0, cost: 0 };
      current.count += 1;
      current.cost += ticket.total;
      map.set(ticket.inventoryItemId, current);
    }
    return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 4);
  }, [tickets]);

  const totals = {
    active: activeTickets.length,
    cost: tickets.reduce((sum, ticket) => sum + ticket.total, 0),
    repair: tickets.filter((ticket) => ticket.reason === "repair").length,
    maintenance: tickets.filter((ticket) => ticket.reason === "maintenance").length,
    service: tickets.filter((ticket) => ticket.reason === "service").length,
  };

  async function moveTicket(ticket: WorkshopTicket, status: WorkshopStatus) {
    if (ticket.status === status) return;
    await updateWorkshopTicket(ticket.id, { status });
  }

  /**
   * Итог диагностики. Исправен — заявка закрывается, инструмент возвращается в
   * каталог свободным. Нужен ремонт — та же заявка меняет причину и уходит в
   * работу: заводить вторую по тому же инструменту незачем, история должна быть
   * одной ниткой.
   */
  async function finishDiagnostics(ticket: WorkshopTicket, needsRepair: boolean) {
    setBusy(true);
    try {
      if (needsRepair) {
        await updateWorkshopTicket(ticket.id, {
          reason: "repair",
          status: "in_progress",
          title: ticket.title.replace(/^Диагностика/, "Ремонт"),
        });
      } else {
        await updateWorkshopTicket(ticket.id, { status: "done" });
      }
    } finally {
      setBusy(false);
    }
  }

  async function addLine(ticket: WorkshopTicket) {
    const type = window.confirm("Это запчасть? Нажмите OK для запчасти или Отмена для услуги.") ? "part" : "service";
    const name = window.prompt(type === "part" ? "Название запчасти" : "Название услуги");
    if (!name?.trim()) return;
    const qty = parseAmount(window.prompt("Количество", "1"));
    const price = parseAmount(window.prompt("Цена, ₸", "0"));
    if (qty <= 0 || price < 0) return;
    const line: WorkshopLine = {
      id: `wl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type,
      name: name.trim(),
      qty,
      price,
    };
    await updateWorkshopTicket(ticket.id, { lines: [...ticket.lines, line] });
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]/70 px-4 py-3 backdrop-blur sm:px-6 sm:py-4">
        <div>
          <h1 className="font-display text-[19px] font-bold">Мастерская</h1>
          <p className="text-[13.5px] text-[var(--color-text-muted)]">Ремонт, обслуживание и диагностика оборудования</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-1.5 rounded-[10px] bg-[var(--color-primary)] px-4 py-2.5 text-[14px] font-semibold text-[var(--color-on-primary)] transition hover:bg-[var(--color-primary-hover)]"
        >
          <Plus className="h-4 w-4" /> Новая заявка
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
          <Metric label="Активных заявок" value={String(totals.active)} />
          <Metric label="Затраты на ремонт" value={formatMoney(totals.cost)} />
          <Metric label="Ремонтов" value={String(totals.repair)} />
          <Metric label="Диагностика" value={String(totals.maintenance)} />
          <Metric label="Обслуживание" value={String(totals.service)} />
        </div>

        {/* Доска занимает всю ширину: при шестидесяти заявках ей нужно место,
            а карточка заявки и сводка по поломкам спокойно живут под ней */}
        <div className="space-y-5">
          <section className="min-w-0 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 card-shadow">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-[17px] font-bold">Доска заявок</h2>
                <p className="text-[13.5px] text-[var(--color-text-muted)]">Перетащите карточку при смене этапа</p>
              </div>
              <span className="shrink-0 rounded-full bg-[var(--color-bg)] px-3 py-1 text-[13px] font-semibold text-[var(--color-text-muted)]">
                {filtering ? `${visibleTickets.length} из ${totals.active}` : `${totals.active} активных`}
              </span>
            </div>

            {/* Отбор: без него доска на шестьдесят заявок превращается в стену */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <div className="relative min-w-[200px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="crm-input py-2 pl-9 text-[13.5px]"
                  placeholder="Инструмент, номер или поломка"
                />
                {query && (
                  <button
                    onClick={() => setQuery("")}
                    className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {/* Переносится по словам: на телефоне «Диагностика» уезжала за край
                  экрана и нажать её было нельзя */}
              <div className="flex flex-wrap items-center gap-1 rounded-[10px] bg-[var(--color-bg)] p-1">
                {(
                  [
                    { key: "all", label: "Все" },
                    { key: "repair", label: "Ремонт" },
                    { key: "service", label: "Обслуживание" },
                    { key: "maintenance", label: "Диагностика" },
                  ] as { key: WorkshopReason | "all"; label: string }[]
                ).map((option) => (
                  <button
                    key={option.key}
                    onClick={() => setReasonFilter(option.key)}
                    className={cn(
                      "rounded-[8px] px-2.5 py-1.5 text-[13px] font-semibold transition",
                      reasonFilter === option.key
                        ? "bg-[var(--color-surface)] text-[var(--color-primary-ink)] shadow-sm"
                        : "text-[var(--color-text-muted)]"
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <ClientTypeFilterToggle value={clientType} onChange={setClientType} />
              <button
                onClick={() => setShowArchive((value) => !value)}
                className={cn(
                  "rounded-[10px] border px-3 py-2 text-[13px] font-semibold transition",
                  showArchive
                    ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary-ink)]"
                    : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]"
                )}
              >
                {showArchive ? "Скрыть архив" : "Архив"}
              </button>
            </div>

            {/* Колонки фиксированной ширины и своя прокрутка у каждой: доска
                растёт вбок, а не тянет страницу вниз на несколько экранов */}
            <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
              {visibleColumns.map((column) => {
                const columnTickets = visibleTickets.filter((ticket) => ticket.status === column.key);
                return (
                  <div
                    key={column.key}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={async () => {
                      const ticket = tickets.find((entry) => entry.id === draggingId);
                      setDraggingId(null);
                      if (ticket) await moveTicket(ticket, column.key);
                    }}
                    className="flex w-[240px] shrink-0 snap-start flex-col rounded-[12px] bg-[var(--color-bg)] p-3"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex min-w-0 items-center gap-2 text-[13.5px] font-semibold">
                        <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", column.dot)} />
                        <span className="truncate">{column.label}</span>
                      </div>
                      <span className="shrink-0 rounded-full bg-[var(--color-surface)] px-2 py-0.5 text-[12.5px] font-semibold text-[var(--color-text-muted)]">
                        {columnTickets.length}
                      </span>
                    </div>
                    <div className="max-h-[52vh] min-h-[120px] space-y-2 overflow-y-auto pr-0.5">
                      {columnTickets.map((ticket) => (
                        <button
                          key={ticket.id}
                          draggable
                          onDragStart={() => setDraggingId(ticket.id)}
                          onClick={() => setSelectedId(ticket.id)}
                          className={cn(
                            "w-full rounded-[10px] border bg-[var(--color-surface)] px-2.5 py-2 text-left transition hover:shadow-sm",
                            selected?.id === ticket.id
                              ? "border-[var(--color-primary)] shadow-[0_0_0_2px_rgba(14,124,102,0.18)]"
                              : "border-[var(--color-border)]"
                          )}
                        >
                          <div className="flex items-start justify-between gap-1.5">
                            <div className="truncate text-[13.5px] font-semibold">{ticket.inventoryItem?.name ?? ticket.title}</div>
                            {ticket.reason === "repair" ? (
                              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#C0272D]" />
                            ) : (
                              <Settings2
                                className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", ticket.reason === "service" ? "text-[#2B5FD9]" : "text-[#B8860B]")}
                              />
                            )}
                          </div>
                          <div className="truncate text-[12px] text-[var(--color-text-muted)]">{ticket.title}</div>
                          <div className="mt-1.5 flex items-center justify-between text-[12px]">
                            <span className="text-[var(--color-text-muted)]">{ticket.number}</span>
                            {ticket.total > 0 && <span className="font-semibold">{formatMoney(ticket.total)}</span>}
                          </div>
                        </button>
                      ))}
                      {columnTickets.length === 0 && (
                        <div className="grid h-20 place-items-center rounded-[10px] border border-dashed border-[var(--color-border)] px-2 text-center text-[12.5px] text-[var(--color-text-muted)]">
                          {filtering ? "Ничего не нашлось" : "Нет заявок"}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            {selected ? (
              <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 card-shadow">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[13px] font-semibold text-[var(--color-primary-ink)]">{selected.number}</div>
                    <h2 className="mt-1 text-[17px] font-bold">{selected.inventoryItem?.name ?? "Оборудование"}</h2>
                    <p className="text-[13.5px] text-[var(--color-text-muted)]">{reasonLabels[selected.reason]} · {selected.title}</p>
                  </div>
                  <button
                    onClick={async () => {
                      if (!confirm(`Удалить заявку ${selected.number}?`)) return;
                      await deleteWorkshopTicket(selected.id);
                      setSelectedId(null);
                    }}
                    title="Удалить заявку"
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px] text-[var(--color-text-muted)] transition hover:bg-[#FDECEC] hover:text-[#C0272D]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="mb-4 grid grid-cols-3 gap-2">
                  {columns.map((column) => (
                    <button
                      key={column.key}
                      onClick={() => moveTicket(selected, column.key)}
                      className={cn(
                        "rounded-[10px] border px-2 py-2 text-[13px] font-semibold transition",
                        selected.status === column.key
                          ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary-ink)]"
                          : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]"
                      )}
                    >
                      {column.label}
                    </button>
                  ))}
                </div>

                {selected.description && <p className="mb-4 rounded-[10px] bg-[var(--color-bg)] px-3 py-2 text-[13.5px]">{selected.description}</p>}

                {/* Итог диагностики: либо инструмент годен, либо нужен ремонт.
                    Раньше приёмщик перекладывал статусы вручную и путался */}
                {(selected.reason === "maintenance" || selected.reason === "service") && selected.status !== "archived" && (
                  <div className="mb-4 rounded-[12px] border border-[var(--color-border)] p-3">
                    <p className="mb-2 text-[13px] font-semibold text-[var(--color-text-muted)]">
                      {selected.reason === "service" ? "Итог обслуживания" : "Что показала диагностика"}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => finishDiagnostics(selected, false)}
                        disabled={busy}
                        className="rounded-[10px] border border-[#1C8A46] bg-[#EAF7EE] py-2 text-[13.5px] font-semibold text-[#1C8A46] transition hover:bg-[#DCF0E3] disabled:opacity-50"
                      >
                        Исправен, в строй
                      </button>
                      <button
                        onClick={() => finishDiagnostics(selected, true)}
                        disabled={busy}
                        className="rounded-[10px] border border-[#C0272D] bg-[#FDECEC] py-2 text-[13.5px] font-semibold text-[#C0272D] transition hover:bg-[#FADFDF] disabled:opacity-50"
                      >
                        Нужен ремонт
                      </button>
                    </div>
                  </div>
                )}

                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-[14.5px] font-semibold">Запчасти и услуги</h3>
                  <button onClick={() => addLine(selected)} className="grid h-7 w-7 place-items-center rounded-[8px] bg-[var(--color-primary)] text-[var(--color-on-primary)]">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="space-y-2">
                  {selected.lines.map((line) => (
                    <div key={line.id} className="rounded-[10px] border border-[var(--color-border)] px-3 py-2 text-[13.5px]">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{line.name}</span>
                        <span className="font-semibold">{formatMoney(line.qty * line.price)}</span>
                      </div>
                      <div className="mt-1 text-[12.5px] text-[var(--color-text-muted)]">
                        {line.type === "part" ? "Запчасть" : "Услуга"} · {line.qty} × {formatMoney(line.price)}
                      </div>
                    </div>
                  ))}
                  {selected.lines.length === 0 && <p className="rounded-[10px] bg-[var(--color-bg)] px-3 py-3 text-[13.5px] text-[var(--color-text-muted)]">Добавьте детали и работы, итог посчитается автоматически.</p>}
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-[var(--color-border)] pt-3">
                  <span className="text-[14px] text-[var(--color-text-muted)]">Итого</span>
                  <span className="text-[17px] font-bold">{formatMoney(selected.total)}</span>
                </div>
                {selected.inventoryItem && (
                  <Link href={`/catalog/${selected.inventoryItemId}`} className="mt-3 block rounded-[10px] border border-[var(--color-border)] py-2 text-center text-[13.5px] font-semibold transition hover:bg-[var(--color-bg)]">
                    Открыть карточку инвентаря
                  </Link>
                )}
              </section>
            ) : (
              <section className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-[14px] text-[var(--color-text-muted)]">
                Выберите заявку на доске
              </section>
            )}

            <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 card-shadow">
              <h2 className="mb-3 text-[15px] font-semibold">Аналитика поломок</h2>
              <div className="space-y-2">
                {brokenByItem.map((row) => (
                  <div key={row.item?.id ?? row.count} className="flex items-center justify-between rounded-[10px] bg-[var(--color-bg)] px-3 py-2 text-[13.5px]">
                    <span className="truncate">{row.item?.name ?? "Оборудование"}</span>
                    <span className="shrink-0 font-semibold">{row.count} · {formatMoney(row.cost)}</span>
                  </div>
                ))}
                {brokenByItem.length === 0 && <p className="text-[13.5px] text-[var(--color-text-muted)]">Данные появятся после первых заявок.</p>}
              </div>
            </section>
          </div>
        </div>
      </div>

      {showNew && (
        <NewTicketModal
          inventory={inventory}
          busyIds={busyItemIds}
          onClose={() => setShowNew(false)}
          onCreate={addWorkshopTicket}
        />
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 card-shadow">
      <div className="text-[13px] text-[var(--color-text-muted)]">{label}</div>
      <div className="mt-1 text-[18px] font-bold">{value}</div>
    </div>
  );
}

/**
 * Поиск оборудования для заявки.
 *
 * Был обычный выпадающий список со всем складом: чтобы найти перфоратор среди
 * трёхсот позиций, приходилось листать. Теперь поле поиска по названию,
 * артикулу, серийному номеру и категории, а рядом с каждой строкой — состояние
 * позиции: приёмщик сразу видит, что инструмент уже в мастерской, и не заводит
 * вторую заявку по тому же станку.
 */
function InventoryPicker({
  items,
  value,
  onChange,
  busyIds,
}: {
  items: InventoryItem[];
  value: string;
  onChange: (id: string) => void;
  busyIds: Set<string>;
}) {
  const [query, setQuery] = useState("");
  const selected = items.find((item) => item.id === value);

  const found = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 40);
    const words = q.split(/\s+/);
    return items
      .filter((item) => {
        const haystack = `${item.name} ${item.sku ?? ""} ${item.serialNumber ?? ""} ${item.category ?? ""}`.toLowerCase();
        return words.every((word) => haystack.includes(word));
      })
      .slice(0, 40);
  }, [items, query]);

  return (
    <div>
      <span className="mb-1 block text-[13px] font-medium text-[var(--color-text-muted)]">Оборудование</span>

      {selected ? (
        <div className="flex items-center gap-3 rounded-[10px] border border-[var(--color-primary)] bg-[var(--color-primary-soft)] px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-semibold text-[var(--color-primary-ink)]">{selected.name}</div>
            <div className="truncate text-[12.5px] text-[var(--color-primary-ink)] opacity-80">
              {[selected.sku, selected.category, inventoryStatusLabels[selected.status]].filter(Boolean).join(" · ")}
            </div>
          </div>
          <button
            onClick={() => {
              onChange("");
              setQuery("");
            }}
            className="shrink-0 rounded-[8px] px-2 py-1 text-[13px] font-semibold text-[var(--color-primary-ink)] hover:bg-[var(--color-surface)]"
          >
            Изменить
          </button>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && found[0]) {
                  event.preventDefault();
                  onChange(found[0].id);
                }
              }}
              className="crm-input pl-9"
              placeholder="Название, артикул или серийный номер"
            />
          </div>
          <div className="mt-2 max-h-56 overflow-y-auto rounded-[10px] border border-[var(--color-border)]">
            {found.length === 0 ? (
              <p className="px-3 py-4 text-center text-[13.5px] text-[var(--color-text-muted)]">Ничего не нашлось</p>
            ) : (
              found.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onChange(item.id)}
                  className="flex w-full items-center gap-3 border-b border-[var(--color-border)] px-3 py-2 text-left last:border-0 hover:bg-[var(--color-bg)]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-medium">{item.name}</div>
                    <div className="truncate text-[12px] text-[var(--color-text-muted)]">
                      {[item.sku, item.category].filter(Boolean).join(" · ") || "без артикула"}
                    </div>
                  </div>
                  {busyIds.has(item.id) ? (
                    <span className="shrink-0 rounded-full bg-[#FEF6E3] px-2 py-0.5 text-[11.5px] font-semibold text-[#B8860B]">
                      уже в мастерской
                    </span>
                  ) : (
                    <span className="shrink-0 text-[11.5px] text-[var(--color-text-muted)]">
                      {inventoryStatusLabels[item.status]}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
          {!query && items.length > found.length && (
            <p className="mt-1 text-[12.5px] text-[var(--color-text-muted)]">
              Показаны первые {found.length} из {items.length} — начните вводить название.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function NewTicketModal({
  inventory,
  busyIds,
  onClose,
  onCreate,
}: {
  inventory: InventoryItem[];
  busyIds: Set<string>;
  onClose: () => void;
  onCreate: (input: Partial<WorkshopTicket>) => Promise<WorkshopTicket>;
}) {
  const candidates = inventory.filter((item) => item.status !== "written_off");
  // Пусто по умолчанию: раньше подставлялась первая позиция склада, и заявку
  // ничего не мешало создать не на тот инструмент, просто нажав «Создать»
  const [inventoryItemId, setInventoryItemId] = useState("");
  const [reason, setReason] = useState<WorkshopReason>("repair");
  const [title, setTitle] = useState("Ремонт оборудования");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!inventoryItemId) {
      setError("Выберите оборудование");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onCreate({
        inventoryItemId,
        reason,
        title: title.trim() || reasonLabels[reason],
        description: description.trim() || undefined,
        lines: [],
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать заявку");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4">
      <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[20px] bg-[var(--color-surface)] p-5 pb-8 card-shadow safe-bottom sm:max-w-[520px] sm:rounded-[16px] sm:pb-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[17px] font-bold">Новая заявка мастерской</h2>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-[8px] hover:bg-[var(--color-bg)]">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3">
          <InventoryPicker items={candidates} value={inventoryItemId} onChange={setInventoryItemId} busyIds={busyIds} />
          {busyIds.has(inventoryItemId) && (
            <p className="rounded-[10px] bg-[#FEF6E3] px-3 py-2 text-[13px] text-[#8A6414]">
              По этому инструменту уже есть незакрытая заявка. Если это тот же случай — лучше дописать её, а не заводить вторую.
            </p>
          )}
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { value: "repair", label: "Ремонт", title: "Ремонт оборудования", cls: "border-[#F3B7B7] bg-[#FDECEC] text-[#C0272D]" },
                { value: "service", label: "Обслуживание", title: "Плановое обслуживание", cls: "border-[#BFD8FB] bg-[#EDF4FE] text-[#2B5FD9]" },
                { value: "maintenance", label: "Диагностика", title: "Диагностика после возврата", cls: "border-[#FFDCA8] bg-[#FFF8EA] text-[#B8620A]" },
              ] as { value: WorkshopReason; label: string; title: string; cls: string }[]
            ).map((o) => (
              <button
                key={o.value}
                onClick={() => {
                  setReason(o.value);
                  setTitle(o.title);
                }}
                className={cn("rounded-[10px] border py-2 text-[13.5px] font-semibold", reason === o.value ? o.cls : "border-[var(--color-border)]")}
              >
                {o.label}
              </button>
            ))}
          </div>
          <input value={title} onChange={(event) => setTitle(event.target.value)} className="crm-input" placeholder="Название заявки" />
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} className="crm-input min-h-24 resize-none" placeholder="Описание поломки или работы" />
          {error && <p className="text-[13.5px] font-medium text-[#C0272D]">{error}</p>}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full rounded-[10px] bg-[var(--color-primary)] py-2.5 text-[14px] font-semibold text-[var(--color-on-primary)] transition hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
          >
            {submitting ? "Создание…" : "Создать заявку"}
          </button>
        </div>
      </div>
    </div>
  );
}

function parseAmount(input: string | null) {
  if (input === null) return 0;
  const normalized = input.replace(/\s/g, "").replace(",", ".").replace(/[^\d.]/g, "");
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : 0;
}
