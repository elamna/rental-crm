"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAppStore } from "@/lib/store";
import { InventoryItem, WorkshopLine, WorkshopReason, WorkshopStatus, WorkshopTicket } from "@/lib/types";
import { cn, formatMoney } from "@/lib/utils";
import { AlertTriangle, Archive, CheckCircle2, Circle, Clock3, Plus, Settings2, Wrench, X } from "lucide-react";

const columns: { key: WorkshopStatus; label: string; dot: string; icon: React.ElementType }[] = [
  { key: "new", label: "Новая", dot: "bg-[#8B8F98]", icon: Circle },
  { key: "in_progress", label: "В работе", dot: "bg-[#F59E0B]", icon: Clock3 },
  { key: "done", label: "Готово", dot: "bg-[#34C987]", icon: CheckCircle2 },
  { key: "archived", label: "Архив", dot: "bg-[#8B8F98]", icon: Archive },
];

const reasonLabels: Record<WorkshopReason, string> = {
  maintenance: "Профилактика",
  repair: "Ремонт",
};

export default function WorkshopPage() {
  const tickets = useAppStore((s) => s.workshopTickets);
  const inventory = useAppStore((s) => s.inventory);
  const addWorkshopTicket = useAppStore((s) => s.addWorkshopTicket);
  const updateWorkshopTicket = useAppStore((s) => s.updateWorkshopTicket);
  const [showNew, setShowNew] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const selected = tickets.find((ticket) => ticket.id === selectedId) ?? tickets[0];
  const activeTickets = tickets.filter((ticket) => ticket.status !== "archived");
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
  };

  async function moveTicket(ticket: WorkshopTicket, status: WorkshopStatus) {
    if (ticket.status === status) return;
    await updateWorkshopTicket(ticket.id, { status });
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
      <header className="flex items-center justify-between border-b border-[var(--color-border)] bg-white/70 px-6 py-4 backdrop-blur">
        <div>
          <h1 className="font-display text-[19px] font-bold">Мастерская</h1>
          <p className="text-[12.5px] text-[var(--color-text-muted)]">Ремонт, профилактика и история обслуживания оборудования</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-1.5 rounded-[10px] bg-[var(--color-primary)] px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[var(--color-primary-hover)]"
        >
          <Plus className="h-4 w-4" /> Новая заявка
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-4">
          <Metric label="Активных заявок" value={String(totals.active)} />
          <Metric label="Затраты на ремонт" value={formatMoney(totals.cost)} />
          <Metric label="Ремонтов" value={String(totals.repair)} />
          <Metric label="Профилактика" value={String(totals.maintenance)} />
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="min-w-0 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-5 card-shadow">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-display text-[16px] font-bold">Доска заявок</h2>
                <p className="text-[12.5px] text-[var(--color-text-muted)]">Перетащите карточку при смене этапа</p>
              </div>
              <span className="rounded-full bg-[var(--color-bg)] px-3 py-1 text-[12px] font-semibold text-[var(--color-text-muted)]">
                {totals.active} активных
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
              {columns.map((column) => {
                const columnTickets = tickets.filter((ticket) => ticket.status === column.key);
                return (
                  <div
                    key={column.key}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={async () => {
                      const ticket = tickets.find((entry) => entry.id === draggingId);
                      setDraggingId(null);
                      if (ticket) await moveTicket(ticket, column.key);
                    }}
                    className="min-h-[360px] rounded-[12px] bg-[var(--color-bg)] p-3"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[13px] font-semibold">
                        <span className={cn("h-2.5 w-2.5 rounded-full", column.dot)} />
                        {column.label}
                      </div>
                      <span className="text-[12px] text-[var(--color-text-muted)]">{columnTickets.length}</span>
                    </div>
                    <div className="space-y-2">
                      {columnTickets.map((ticket) => (
                        <button
                          key={ticket.id}
                          draggable
                          onDragStart={() => setDraggingId(ticket.id)}
                          onClick={() => setSelectedId(ticket.id)}
                          className={cn(
                            "w-full rounded-[10px] border bg-white px-3 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm",
                            selected?.id === ticket.id ? "border-[var(--color-primary)] shadow-[0_0_0_2px_rgba(109,74,255,0.15)]" : "border-[var(--color-border)]"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate text-[13px] font-semibold">{ticket.inventoryItem?.name ?? ticket.title}</div>
                              <div className="mt-0.5 text-[11.5px] text-[var(--color-text-muted)]">{ticket.title}</div>
                            </div>
                            {ticket.reason === "repair" ? <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[#C0272D]" /> : <Settings2 className="h-3.5 w-3.5 shrink-0 text-[#B8860B]" />}
                          </div>
                          <div className="mt-2 flex items-center justify-between text-[11.5px]">
                            <span className="text-[var(--color-text-muted)]">{ticket.number}</span>
                            <span className="font-semibold">{formatMoney(ticket.total)}</span>
                          </div>
                        </button>
                      ))}
                      {columnTickets.length === 0 && (
                        <div className="grid h-24 place-items-center rounded-[10px] border border-dashed border-[var(--color-border)] text-[12px] text-[var(--color-text-muted)]">
                          Нет заявок
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <aside className="space-y-4">
            {selected ? (
              <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-5 card-shadow">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[12px] font-semibold text-[var(--color-primary)]">{selected.number}</div>
                    <h2 className="mt-1 text-[16px] font-bold">{selected.inventoryItem?.name ?? "Оборудование"}</h2>
                    <p className="text-[12.5px] text-[var(--color-text-muted)]">{reasonLabels[selected.reason]} · {selected.title}</p>
                  </div>
                  <Wrench className="h-5 w-5 text-[var(--color-primary)]" />
                </div>

                <div className="mb-4 grid grid-cols-2 gap-2">
                  {columns.map((column) => (
                    <button
                      key={column.key}
                      onClick={() => moveTicket(selected, column.key)}
                      className={cn(
                        "rounded-[10px] border px-2 py-2 text-[12px] font-semibold transition",
                        selected.status === column.key
                          ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
                          : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]"
                      )}
                    >
                      {column.label}
                    </button>
                  ))}
                </div>

                {selected.description && <p className="mb-4 rounded-[10px] bg-[var(--color-bg)] px-3 py-2 text-[12.5px]">{selected.description}</p>}

                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-[13.5px] font-semibold">Запчасти и услуги</h3>
                  <button onClick={() => addLine(selected)} className="grid h-7 w-7 place-items-center rounded-[8px] bg-[var(--color-primary)] text-white">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="space-y-2">
                  {selected.lines.map((line) => (
                    <div key={line.id} className="rounded-[10px] border border-[var(--color-border)] px-3 py-2 text-[12.5px]">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{line.name}</span>
                        <span className="font-semibold">{formatMoney(line.qty * line.price)}</span>
                      </div>
                      <div className="mt-1 text-[11.5px] text-[var(--color-text-muted)]">
                        {line.type === "part" ? "Запчасть" : "Услуга"} · {line.qty} × {formatMoney(line.price)}
                      </div>
                    </div>
                  ))}
                  {selected.lines.length === 0 && <p className="rounded-[10px] bg-[var(--color-bg)] px-3 py-3 text-[12.5px] text-[var(--color-text-muted)]">Добавьте детали и работы, итог посчитается автоматически.</p>}
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-[var(--color-border)] pt-3">
                  <span className="text-[13px] text-[var(--color-text-muted)]">Итого</span>
                  <span className="text-[17px] font-bold">{formatMoney(selected.total)}</span>
                </div>
                {selected.inventoryItem && (
                  <Link href={`/catalog/${selected.inventoryItemId}`} className="mt-3 block rounded-[10px] border border-[var(--color-border)] py-2 text-center text-[12.5px] font-semibold transition hover:bg-[var(--color-bg)]">
                    Открыть карточку инвентаря
                  </Link>
                )}
              </section>
            ) : (
              <section className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)] bg-white p-5 text-[13px] text-[var(--color-text-muted)]">
                Выберите заявку на доске
              </section>
            )}

            <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-5 card-shadow">
              <h2 className="mb-3 text-[14px] font-semibold">Аналитика поломок</h2>
              <div className="space-y-2">
                {brokenByItem.map((row) => (
                  <div key={row.item?.id ?? row.count} className="flex items-center justify-between rounded-[10px] bg-[var(--color-bg)] px-3 py-2 text-[12.5px]">
                    <span className="truncate">{row.item?.name ?? "Оборудование"}</span>
                    <span className="shrink-0 font-semibold">{row.count} · {formatMoney(row.cost)}</span>
                  </div>
                ))}
                {brokenByItem.length === 0 && <p className="text-[12.5px] text-[var(--color-text-muted)]">Данные появятся после первых заявок.</p>}
              </div>
            </section>
          </aside>
        </div>
      </div>

      {showNew && <NewTicketModal inventory={inventory} onClose={() => setShowNew(false)} onCreate={addWorkshopTicket} />}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white px-4 py-3 card-shadow">
      <div className="text-[12px] text-[var(--color-text-muted)]">{label}</div>
      <div className="mt-1 text-[18px] font-bold">{value}</div>
    </div>
  );
}

function NewTicketModal({
  inventory,
  onClose,
  onCreate,
}: {
  inventory: InventoryItem[];
  onClose: () => void;
  onCreate: (input: Partial<WorkshopTicket>) => Promise<WorkshopTicket>;
}) {
  const candidates = inventory.filter((item) => item.status !== "written_off");
  const [inventoryItemId, setInventoryItemId] = useState(candidates[0]?.id ?? "");
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
      <div className="w-full max-w-[520px] rounded-[16px] bg-white p-5 card-shadow">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[16px] font-bold">Новая заявка мастерской</h2>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-[8px] hover:bg-[var(--color-bg)]">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-[var(--color-text-muted)]">Оборудование</span>
            <select value={inventoryItemId} onChange={(event) => setInventoryItemId(event.target.value)} className="crm-input">
              {candidates.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.sku || item.id}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                setReason("repair");
                setTitle("Ремонт оборудования");
              }}
              className={cn("rounded-[10px] border py-2 text-[13px] font-semibold", reason === "repair" ? "border-[#F3B7B7] bg-[#FDECEC] text-[#C0272D]" : "border-[var(--color-border)]")}
            >
              Требует ремонта
            </button>
            <button
              onClick={() => {
                setReason("maintenance");
                setTitle("Профилактика оборудования");
              }}
              className={cn("rounded-[10px] border py-2 text-[13px] font-semibold", reason === "maintenance" ? "border-[#FFDCA8] bg-[#FFF8EA] text-[#B8620A]" : "border-[var(--color-border)]")}
            >
              Требует профилактики
            </button>
          </div>
          <input value={title} onChange={(event) => setTitle(event.target.value)} className="crm-input" placeholder="Название заявки" />
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} className="crm-input min-h-24 resize-none" placeholder="Описание поломки или работы" />
          {error && <p className="text-[12.5px] font-medium text-[#C0272D]">{error}</p>}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full rounded-[10px] bg-[var(--color-primary)] py-2.5 text-[13px] font-semibold text-white transition hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
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
