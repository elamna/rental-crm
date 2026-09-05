"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAppStore } from "@/lib/store";
import { useAuth } from "@/components/auth/auth-provider";
import { branches, rentalPeriods, depositTypeLabels } from "@/lib/mock-data";
import { Client, InventoryLine, LineCategory, PaymentStatus, Rental, RentalPeriod } from "@/lib/types";
import { cn, formatDateTimeDisplay, formatMoney, statusLabels, statusStyles, durationDays } from "@/lib/utils";
import { QuickClientModal } from "@/components/clients/quick-client-modal";
import { AddCatalogBundleModal } from "@/components/rentals/add-catalog-bundle-modal";
import { AddCatalogItemModal } from "@/components/rentals/add-catalog-item-modal";
import {
  ArrowLeft,
  Search,
  UserPlus,
  MoreHorizontal,
  Video,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Tag,
  FileText,
  ShieldCheck,
  AlertOctagon,
  Receipt,
  MessageSquare,
  Siren,
  Ban,
  Banknote,
  QrCode,
  Building2,
  X,
  CreditCard,
} from "lucide-react";

function toLocalInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const tabDefs: { key: "all" | LineCategory; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "product", label: "Продукты" },
  { key: "kit", label: "Комплекты" },
  { key: "service", label: "Услуги" },
];

export default function NewRentalPage() {
  const router = useRouter();
  const { user: sessionUser } = useAuth();
  const clients = useAppStore((s) => s.clients);
  const rentals = useAppStore((s) => s.rentals);
  const addRental = useAppStore((s) => s.addRental);
  const updateRental = useAppStore((s) => s.updateRental);

  const [rentalId] = useState(() => `r_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  const [number] = useState(() => `№${Date.now().toString().slice(-6)}`);
  const [persisted, setPersisted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientQuery, setClientQuery] = useState("");
  const [showClientModal, setShowClientModal] = useState(false);
  // Модальное предупреждение при выборе клиента из ЧС
  const [blacklistWarningClient, setBlacklistWarningClient] = useState<Client | null>(null);

  // Украденные аренды выбранного клиента для предупреждения
  const clientStolenRentals = useMemo(() => {
    if (!selectedClient?.blacklisted) return [];
    return rentals.filter((r) => r.client.id === selectedClient.id && r.status === "stolen");
  }, [selectedClient, rentals]);

  const [startAt, setStartAt] = useState(() => toLocalInputValue(new Date()));
  const [endAt, setEndAt] = useState(() => toLocalInputValue(new Date(Date.now() + 24 * 3600 * 1000)));
  const [branch, setBranch] = useState("Атырау");
  const [period, setPeriod] = useState<RentalPeriod>("daily");

  const [items, setItems] = useState<InventoryLine[]>([]);
  const [tab, setTab] = useState<"all" | LineCategory>("all");
  const [addModalCategory, setAddModalCategory] = useState<LineCategory | null>(null);

  const [discountPct, setDiscountPct] = useState(0);
  const [paid, setPaid] = useState(0);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const [docsOpen, setDocsOpen] = useState(true);
  const [documents, setDocuments] = useState<string[]>([]);
  const [deposit, setDeposit] = useState<{ type: keyof typeof depositTypeLabels; amount: number } | null>(null);
  const [depositFormOpen, setDepositFormOpen] = useState(false);
  const [depositDraft, setDepositDraft] = useState({ type: "money" as keyof typeof depositTypeLabels, amount: "" });
  const [autoPenalty, setAutoPenalty] = useState(false);
  const [penaltyRate, setPenaltyRate] = useState("500");
  const [penalties, setPenalties] = useState<{ reason: string; amount: number }[]>([]);
  const [penaltyFormOpen, setPenaltyFormOpen] = useState(false);
  const [penaltyDraft, setPenaltyDraft] = useState({ reason: "", amount: "" });
  const [expenses, setExpenses] = useState<{ type: string; amount: number }[]>([]);
  const [expenseFormOpen, setExpenseFormOpen] = useState(false);
  const [expenseDraft, setExpenseDraft] = useState({ type: "", amount: "" });
  const [notes, setNotes] = useState<string[]>([]);
  const [noteDraft, setNoteDraft] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  const duration = durationDays(new Date(startAt).toISOString(), new Date(endAt).toISOString());

  const filteredClients = useMemo(() => {
    if (!clientQuery.trim()) return [];
    const q = clientQuery.trim().toLowerCase();
    return clients.filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q)).slice(0, 6);
  }, [clientQuery, clients]);

  const visibleItems = tab === "all" ? items : items.filter((i) => (i.category ?? "product") === tab);
  const countFor = (k: "all" | LineCategory) => (k === "all" ? items.length : items.filter((i) => (i.category ?? "product") === k).length);

  const itemsTotal = items.reduce((s, i) => s + i.pricePerDay * i.qty, 0) * duration;
  const discountValue = Math.round(itemsTotal * (discountPct / 100));
  const penaltiesSum = penalties.reduce((s, p) => s + p.amount, 0);
  const total = Math.max(0, itemsTotal - discountValue + penaltiesSum);
  const remaining = Math.max(0, total - paid);

  function paymentStatusFor(t: number, p: number): PaymentStatus {
    if (t <= 0 || p <= 0) return "pending";
    if (p >= t) return "paid";
    return "partial";
  }

  function parsePaymentAmount(input: string | null) {
    if (input === null) return null;
    const normalized = input.replace(/\s/g, "").replace(",", ".").replace(/[^\d.]/g, "");
    const amount = Number(normalized);
    return Number.isFinite(amount) ? amount : 0;
  }

  function buildRental(status: Rental["status"]): Rental {
    const startIso = new Date(startAt).toISOString();
    const endIso = new Date(endAt).toISOString();
    return {
      id: rentalId,
      number,
      status,
      paymentStatus: paymentStatusFor(total, paid),
      branch,
      startDate: formatDateTimeDisplay(startIso),
      endDate: formatDateTimeDisplay(endIso),
      startAt: startIso,
      endAt: endIso,
      rentalPeriod: period,
      client: selectedClient as Client,
      total,
      paid,
      items,
      bookedBy: sessionUser
        ? { id: sessionUser.id, name: sessionUser.name, initials: sessionUser.name.split(" ").slice(0, 2).map((n: string) => n[0]).join("").toUpperCase(), role: "" }
        : { id: "unknown", name: "Неизвестно", initials: "—", role: "" },
      issuedBy: undefined,
      comment: notes.length ? notes.join(" · ") : undefined,
      delivery: false,
      deposit: deposit ? { type: deposit.type, amount: deposit.amount, returned: false } : undefined,
      penalties,
      expenses,
      documents,
      notes,
      autoPenaltyEnabled: autoPenalty,
      penaltyRatePerHour: autoPenalty ? Number(penaltyRate) || 0 : undefined,
    };
  }

  async function persist(status: Rental["status"]) {
    if (!selectedClient) {
      alert("Сначала выберите или создайте клиента");
      return false;
    }
    if (!branch) {
      alert("Укажите пункт проката");
      return false;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const rental = buildRental(status);
      if (!persisted) {
        await addRental(rental);
        setPersisted(true);
      } else {
        await updateRental(rentalId, rental);
      }
      return true;
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Не удалось сохранить аренду");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveDraft() {
    if (await persist("request")) alert("Черновик сохранён");
  }

  async function handleBook() {
    if (await persist("booked")) router.push(`/rentals/${rentalId}`);
  }

  function addItem(category: LineCategory, values: { name: string; pricePerDay: number; qty: number; inventoryItemId?: string }) {
    setItems((prev) => [
      ...prev,
      {
        id: `it_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: values.name,
        sku: `NEW-${Math.floor(Math.random() * 900 + 100)}`,
        qty: values.qty,
        pricePerDay: values.pricePerDay,
        category,
        inventoryItemId: values.inventoryItemId,
      },
    ]);
    setAddModalCategory(null);
  }

  const st = statusStyles.request;
  const periodSuffix = period === "hourly" ? "ч." : period === "weekly" ? "нед." : period === "monthly" ? "мес." : "д.";

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-[var(--color-border)] bg-white/70 px-6 py-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="grid h-8 w-8 place-items-center rounded-[10px] border border-[var(--color-border)] transition hover:bg-[var(--color-bg)]">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-[18px] font-bold">Аренда {number}</h1>
            <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold", st.bg, st.text)}>
              <span className={cn("h-1.5 w-1.5 rounded-full", st.dot)} />
              {statusLabels.request}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button onClick={() => setMenuOpen((v) => !v)} className="grid h-9 w-9 place-items-center rounded-[10px] border border-[var(--color-border)] transition hover:bg-[var(--color-bg)]">
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-[calc(100%+6px)] z-20 w-56 rounded-[12px] border border-[var(--color-border)] bg-white p-1.5 card-shadow">
                <Link href="/rentals" className="block rounded-[8px] px-2.5 py-2 text-[13px] font-medium text-[#C0272D] hover:bg-[#FDECEC]">
                  Отменить и выйти без сохранения
                </Link>
              </div>
            )}
          </div>
          {/* Видео — временно скрыто, будет добавлена ссылка на инструкцию */}
          {/* <button className="..."><Video /> Видео</button> */}
          <button
            onClick={handleSaveDraft}
            disabled={saving}
            className="rounded-[10px] border border-[var(--color-border)] bg-white px-4 py-2 text-[13px] font-medium transition hover:bg-[var(--color-bg)] disabled:opacity-50"
          >
            {saving ? "Сохранение…" : "Сохранить изменения"}
          </button>
        </div>
      </header>

      <div className="flex flex-1 gap-5 overflow-y-auto px-6 py-5">
        <div className="min-w-0 flex-1 space-y-4">
          <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-5 card-shadow">
            <h2 className="mb-3 text-[14px] font-semibold">Клиент</h2>
            {selectedClient ? (
              <>
              <div className="flex items-center gap-3 rounded-[10px] border border-[var(--color-border)] px-3 py-2.5">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--color-primary-soft)] text-[12px] font-bold text-[var(--color-primary)]">
                  {selectedClient.name.split(" ").slice(0, 2).map((n) => n[0]).join("")}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[13.5px] font-semibold">{selectedClient.name}</span>
                    {selectedClient.blacklisted && (
                      <span className="flex shrink-0 items-center gap-1 rounded-full bg-[#FDECEC] px-1.5 py-0.5 text-[10px] font-semibold text-[#C0272D]">
                        <Ban className="h-2.5 w-2.5" /> ЧС
                      </span>
                    )}
                  </div>
                  <div className="text-[12px] text-[var(--color-text-muted)]">{selectedClient.phone}</div>
                </div>
                <button onClick={() => setSelectedClient(null)} className="shrink-0 text-[12.5px] font-medium text-[var(--color-primary)] hover:underline">
                  Изменить
                </button>
              </div>

              {/* Предупреждение о чёрном списке */}
              {selectedClient.blacklisted && (
                <div className="mt-3 rounded-[12px] border border-[#F3B7B7] bg-[#FDECEC] p-4">
                  <div className="flex items-center gap-2 text-[#C0272D]">
                    <Siren className="h-4 w-4 shrink-0" />
                    <span className="text-[13px] font-bold">Внимание! Клиент в чёрном списке</span>
                  </div>
                  {clientStolenRentals.length > 0 ? (
                    <div className="mt-2 space-y-2">
                      {clientStolenRentals.map((r) => (
                        <div key={r.id} className="rounded-[8px] bg-white/70 px-3 py-2 text-[12.5px]">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-[#C0272D]">Аренда №{r.number}</span>
                            <span className="font-semibold text-[#C0272D]">{formatMoney(r.total)}</span>
                          </div>
                          {r.items.length > 0 && (
                            <div className="mt-0.5 text-[var(--color-text-muted)]">
                              {r.items.map((i) => i.name).join(", ")}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-1.5 text-[12.5px] text-[#C0272D]/80">
                      Добавлен в чёрный список вручную. Уточните причину перед оформлением аренды.
                    </p>
                  )}
                </div>
              )}
              </>
            ) : (
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
                  <input
                    value={clientQuery}
                    onChange={(e) => setClientQuery(e.target.value)}
                    placeholder="Найти по имени или номеру телефона"
                    className="w-full rounded-[10px] border border-[var(--color-border)] py-2.5 pl-9 pr-3 text-[13.5px] outline-none focus:border-[var(--color-primary)]"
                  />
                  {filteredClients.length > 0 && (
                    <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-20 max-h-64 overflow-y-auto rounded-[10px] border border-[var(--color-border)] bg-white card-shadow">
                      {filteredClients.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => {
                            if (c.blacklisted) {
                              // Сначала показываем предупреждение
                              setBlacklistWarningClient(c);
                              setClientQuery("");
                            } else {
                              setSelectedClient(c);
                              setClientQuery("");
                            }
                          }}
                          className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] hover:bg-[var(--color-bg)]"
                        >
                          <span className="font-medium">{c.name}</span>
                          <span className="text-[var(--color-text-muted)]">{c.phone}</span>
                          {c.blacklisted && (
                            <span className="ml-auto flex shrink-0 items-center gap-1 rounded-full bg-[#FDECEC] px-1.5 py-0.5 text-[10px] font-semibold text-[#C0272D]">
                              <Ban className="h-2.5 w-2.5" /> ЧС
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  {clientQuery.trim() && filteredClients.length === 0 && (
                    <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-20 rounded-[10px] border border-[var(--color-border)] bg-white px-3 py-2.5 text-[12.5px] text-[var(--color-text-muted)] card-shadow">
                      Клиент не найден
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setShowClientModal(true)}
                  className="flex shrink-0 items-center gap-1.5 rounded-[10px] bg-[#16151F] px-3.5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-black"
                >
                  <UserPlus className="h-4 w-4" /> Новый клиент
                </button>
              </div>
            )}
          </section>

          <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-5 card-shadow">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[14px] font-semibold">Аренда</h2>
              <span className="rounded-full bg-[var(--color-bg)] px-3 py-1 text-[12px] font-medium text-[var(--color-text-muted)]">
                Длительность: {duration} {periodSuffix}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Начало аренды" required>
                <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} className="crm-input" />
              </Field>
              <Field label="Конец аренды" required>
                <input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} className="crm-input" />
              </Field>
              <Field label="Пункт проката" required>
                <select value={branch} onChange={(e) => setBranch(e.target.value)} className="crm-input">
                  {branches.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </Field>
              <Field label="Период аренды">
                <select value={period} onChange={(e) => setPeriod(e.target.value as RentalPeriod)} className="crm-input">
                  {rentalPeriods.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </section>

          <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-5 card-shadow">
            <div className="mb-3 flex items-center gap-1 rounded-[10px] bg-[var(--color-bg)] p-1">
              {tabDefs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-[12.5px] font-semibold transition",
                    tab === t.key ? "bg-white text-[var(--color-primary)] shadow-sm" : "text-[var(--color-text-muted)]"
                  )}
                >
                  {t.label}
                  <span className={cn("rounded-full px-1.5 py-0.5 text-[11px]", tab === t.key ? "bg-[var(--color-primary-soft)]" : "bg-white")}>
                    {countFor(t.key)}
                  </span>
                </button>
              ))}
            </div>

            {(["product", "kit", "service"] as LineCategory[])
              .filter((cat) => tab === "all" || tab === cat)
              .map((cat) => {
                const catItems = items.filter((i) => (i.category ?? "product") === cat);
                const catLabel = cat === "product" ? "Продукты" : cat === "kit" ? "Комплекты" : "Услуги";
                return (
                  <div key={cat} className="mb-4 last:mb-0">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[12px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{catLabel}</span>
                      <button
                        onClick={() => setAddModalCategory(cat)}
                        className="flex items-center gap-1 rounded-[8px] border border-[var(--color-border)] px-2.5 py-1 text-[12px] font-medium text-[var(--color-text-muted)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                      >
                        <Plus className="h-3 w-3" /> Добавить
                      </button>
                    </div>
                    {catItems.length > 0 ? (
                      <div className="space-y-1.5">
                        {catItems.map((item) => (
                          <div key={item.id} className="flex items-center gap-2.5 rounded-[10px] border border-[var(--color-border)] bg-white px-3 py-2 hover:border-[var(--color-primary-soft)]">
                            {/* Иконка */}
                            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px] bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                              <span className="text-[10px] font-bold">{item.qty}</span>
                            </div>
                            {/* Название */}
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[12.5px] font-medium">{item.name}</div>
                              <div className="text-[11px] text-[var(--color-text-muted)]">{formatMoney(item.pricePerDay)}/сут</div>
                            </div>
                            {/* Сумма */}
                            <span className="shrink-0 text-[12.5px] font-semibold">{formatMoney(item.pricePerDay * item.qty * duration)}</span>
                            {/* Удалить */}
                            <button onClick={() => setItems((prev) => prev.filter((i) => i.id !== item.id))} className="shrink-0 text-[var(--color-text-muted)] hover:text-[#C0272D]">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <button
                        onClick={() => setAddModalCategory(cat)}
                        className="flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-[var(--color-border)] py-2.5 text-[12px] text-[var(--color-text-muted)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                      >
                        <Plus className="h-3 w-3" /> Добавить {catLabel.toLowerCase()}
                      </button>
                    )}
                  </div>
                );
              })}

            {visibleItems.length === 0 && <p className="py-4 text-center text-[12.5px] text-[var(--color-text-muted)]">Пока ничего не добавлено</p>}

            {items.length > 0 && (
              <div className="mt-4 flex items-center justify-between border-t border-[var(--color-border)] pt-3">
                <span className="text-[13px] text-[var(--color-text-muted)]">Итого за {duration} {periodSuffix}</span>
                <span className="text-[16px] font-bold">{formatMoney(itemsTotal)}</span>
              </div>
            )}
          </section>
        </div>

        <div className="w-[340px] shrink-0 space-y-3">
          <button
            onClick={handleBook}
            disabled={saving}
            className="w-full rounded-[12px] bg-[var(--color-primary)] py-3 text-[14px] font-semibold text-white shadow-[0_4px_14px_-4px_rgba(109,74,255,0.7)] transition hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
          >
            {saving ? "Сохранение…" : "Забронировать аренду →"}
          </button>
          {saveError && <p className="text-center text-[12.5px] text-[#C0272D]">{saveError}</p>}

          <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-4 card-shadow">
            {/* Строки сумм */}
            <div className="mb-3 space-y-1.5 text-[13px]">
              <div className="flex items-center justify-between">
                <span className="text-[var(--color-text-muted)]">Инвентарь</span>
                <span className="font-medium">{formatMoney(total)}</span>
              </div>
              {discountValue > 0 && (
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-[var(--color-text-muted)]">Скидка {discountPct}%</span>
                  <span className="text-[#1C8A46]">−{formatMoney(discountValue)}</span>
                </div>
              )}
              <div className="border-t border-[var(--color-border)] pt-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Итого</span>
                  <span className="font-bold">{formatMoney(total - discountValue)}</span>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-[8px] bg-[var(--color-bg)] px-2.5 py-2">
                <span className="text-[12.5px] font-semibold text-[var(--color-text-muted)]">К оплате</span>
                <span className={`text-[15px] font-bold ${remaining > 0 ? "text-[#C0272D]" : "text-[#1C8A46]"}`}>
                  {formatMoney(remaining)}
                </span>
              </div>
              {paid > 0 && remaining > 0 && (
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-[var(--color-text-muted)]">Уже оплачено</span>
                  <span className="font-medium text-[#1C8A46]">{formatMoney(paid)}</span>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setShowPaymentModal(true)}
                className="flex items-center justify-center gap-1.5 rounded-[10px] bg-[#1C8A46] py-2 text-[12.5px] font-semibold text-white transition hover:bg-[#167A3C]"
              >
                + Принять оплату
              </button>
              <button
                onClick={() => {
                  const input = prompt("Скидка, %", String(discountPct));
                  if (input === null) return;
                  const val = Number(input);
                  if (!isNaN(val) && val >= 0 && val <= 100) setDiscountPct(val);
                }}
                className="flex items-center justify-center gap-1.5 rounded-[10px] border border-[var(--color-border)] py-2 text-[12.5px] font-medium text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg)]"
              >
                <Tag className="h-3.5 w-3.5" /> Скидка
              </button>
            </div>
          </div>

          {/* Модалка оплаты */}
          {showPaymentModal && (
            <NewRentalPaymentModal
              remaining={remaining}
              onPay={(amount) => {
                setPaid((p) => Math.min(total, p + amount));
                setShowPaymentModal(false);
              }}
              onClose={() => setShowPaymentModal(false)}
            />
          )}

          <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-4 card-shadow">
            <button onClick={() => setDocsOpen((v) => !v)} className="flex w-full items-center justify-between">
              <span className="flex items-center gap-2 text-[13.5px] font-semibold">
                <FileText className="h-4 w-4 text-[var(--color-primary)]" /> Документы
              </span>
              {docsOpen ? <ChevronUp className="h-4 w-4 text-[var(--color-text-muted)]" /> : <ChevronDown className="h-4 w-4 text-[var(--color-text-muted)]" />}
            </button>
            {docsOpen && (
              <div className="mt-3 space-y-1.5">
                {documents.map((d, i) => (
                  <div key={i} className="rounded-[10px] bg-[var(--color-bg)] px-3 py-2 text-[12.5px]">
                    {d}
                  </div>
                ))}
                <button
                  onClick={() => {
                    const name = prompt("Название документа");
                    if (name?.trim()) setDocuments((d) => [...d, name.trim()]);
                  }}
                  className="flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-[var(--color-border)] py-2 text-[12.5px] font-medium text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg)]"
                >
                  <Plus className="h-3.5 w-3.5" /> Добавить документ
                </button>
              </div>
            )}
          </div>

          <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-4 card-shadow">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-[13.5px] font-semibold">
                <ShieldCheck className="h-4 w-4 text-[var(--color-primary)]" /> Залог
              </span>
              <button onClick={() => setDepositFormOpen((v) => !v)} className="grid h-6 w-6 place-items-center rounded-md border border-[var(--color-border)] hover:bg-[var(--color-bg)]">
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            {deposit && (
              <div className="mt-2 flex items-center justify-between text-[12.5px]">
                <span className="text-[var(--color-text-muted)]">{depositTypeLabels[deposit.type]}</span>
                <span className="font-medium">{formatMoney(deposit.amount)}</span>
              </div>
            )}
            {depositFormOpen && (
              <div className="mt-3 space-y-2">
                <select
                  value={depositDraft.type}
                  onChange={(e) => setDepositDraft((d) => ({ ...d, type: e.target.value as keyof typeof depositTypeLabels }))}
                  className="crm-input"
                >
                  {Object.entries(depositTypeLabels).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  placeholder="Сумма, ₸"
                  value={depositDraft.amount}
                  onChange={(e) => setDepositDraft((d) => ({ ...d, amount: e.target.value }))}
                  className="crm-input"
                />
                <button
                  onClick={() => {
                    const amt = Number(depositDraft.amount);
                    if (amt > 0) {
                      setDeposit({ type: depositDraft.type, amount: amt });
                      setDepositFormOpen(false);
                      setDepositDraft({ type: "money", amount: "" });
                    }
                  }}
                  className="w-full rounded-[10px] bg-[var(--color-primary)] py-2 text-[12.5px] font-semibold text-white hover:bg-[var(--color-primary-hover)]"
                >
                  Сохранить залог
                </button>
              </div>
            )}
          </div>

          <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-4 card-shadow">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-[13.5px] font-semibold">
                <AlertOctagon className="h-4 w-4 text-[var(--color-primary)]" /> Штраф
              </span>
              <button onClick={() => setPenaltyFormOpen((v) => !v)} className="grid h-6 w-6 place-items-center rounded-md border border-[var(--color-border)] hover:bg-[var(--color-bg)]">
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <label className="mt-3 flex items-center justify-between rounded-[10px] bg-[var(--color-bg)] px-3 py-2">
              <div>
                <div className="text-[12.5px] font-medium">Почасовой штраф</div>
                <div className="text-[11px] text-[var(--color-text-muted)]">Автоматический штраф за просрочку</div>
              </div>
              <input type="checkbox" checked={autoPenalty} onChange={(e) => setAutoPenalty(e.target.checked)} className="h-4 w-4 accent-[var(--color-primary)]" />
            </label>
            {autoPenalty && (
              <label className="mt-2 block">
                <span className="mb-1 block text-[11.5px] font-medium text-[var(--color-text-muted)]">Ставка, ₸ за час просрочки</span>
                <input type="number" min={0} value={penaltyRate} onChange={(e) => setPenaltyRate(e.target.value)} className="crm-input" />
              </label>
            )}
            {penalties.map((p, i) => (
              <div key={i} className="mt-2 flex items-center justify-between text-[12.5px]">
                <span className="text-[var(--color-text-muted)]">{p.reason}</span>
                <span className="font-medium text-[#C0272D]">{formatMoney(p.amount)}</span>
              </div>
            ))}
            {penaltyFormOpen && (
              <div className="mt-3 space-y-2">
                <input placeholder="Причина" value={penaltyDraft.reason} onChange={(e) => setPenaltyDraft((d) => ({ ...d, reason: e.target.value }))} className="crm-input" />
                <input
                  type="number"
                  placeholder="Сумма, ₸"
                  value={penaltyDraft.amount}
                  onChange={(e) => setPenaltyDraft((d) => ({ ...d, amount: e.target.value }))}
                  className="crm-input"
                />
                <button
                  onClick={() => {
                    const amt = Number(penaltyDraft.amount);
                    if (penaltyDraft.reason.trim() && amt > 0) {
                      setPenalties((p) => [...p, { reason: penaltyDraft.reason.trim(), amount: amt }]);
                      setPenaltyFormOpen(false);
                      setPenaltyDraft({ reason: "", amount: "" });
                    }
                  }}
                  className="w-full rounded-[10px] bg-[var(--color-primary)] py-2 text-[12.5px] font-semibold text-white hover:bg-[var(--color-primary-hover)]"
                >
                  Добавить штраф
                </button>
              </div>
            )}
          </div>

          <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-4 card-shadow">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-[13.5px] font-semibold">
                <Receipt className="h-4 w-4 text-[var(--color-primary)]" /> Расходы
              </span>
              <button onClick={() => setExpenseFormOpen((v) => !v)} className="grid h-6 w-6 place-items-center rounded-md border border-[var(--color-border)] hover:bg-[var(--color-bg)]">
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            {expenses.map((e, i) => (
              <div key={i} className="mt-2 flex items-center justify-between text-[12.5px]">
                <span className="text-[var(--color-text-muted)]">{e.type}</span>
                <span className="font-medium">{formatMoney(e.amount)}</span>
              </div>
            ))}
            {expenseFormOpen && (
              <div className="mt-3 space-y-2">
                <input
                  placeholder="Тип расхода (транспорт, ремонт...)"
                  value={expenseDraft.type}
                  onChange={(e) => setExpenseDraft((d) => ({ ...d, type: e.target.value }))}
                  className="crm-input"
                />
                <input
                  type="number"
                  placeholder="Сумма, ₸"
                  value={expenseDraft.amount}
                  onChange={(e) => setExpenseDraft((d) => ({ ...d, amount: e.target.value }))}
                  className="crm-input"
                />
                <button
                  onClick={() => {
                    const amt = Number(expenseDraft.amount);
                    if (expenseDraft.type.trim() && amt > 0) {
                      setExpenses((p) => [...p, { type: expenseDraft.type.trim(), amount: amt }]);
                      setExpenseFormOpen(false);
                      setExpenseDraft({ type: "", amount: "" });
                    }
                  }}
                  className="w-full rounded-[10px] bg-[var(--color-primary)] py-2 text-[12.5px] font-semibold text-white hover:bg-[var(--color-primary-hover)]"
                >
                  Добавить расход
                </button>
              </div>
            )}
          </div>

          <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-4 card-shadow">
            <span className="flex items-center gap-2 text-[13.5px] font-semibold">
              <MessageSquare className="h-4 w-4 text-[var(--color-primary)]" /> Заметки и файлы
            </span>
            <div className="mt-3 space-y-2">
              {notes.map((n, i) => (
                <div key={i} className="rounded-[10px] bg-[var(--color-bg)] px-3 py-2 text-[12.5px]">
                  {n}
                </div>
              ))}
              <div className="flex gap-2">
                <input value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder="Написать заметку…" className="crm-input flex-1" />
                <button
                  onClick={() => {
                    if (noteDraft.trim()) {
                      setNotes((n) => [...n, noteDraft.trim()]);
                      setNoteDraft("");
                    }
                  }}
                  className="rounded-[10px] bg-[var(--color-primary)] px-3 text-[13px] font-semibold text-white hover:bg-[var(--color-primary-hover)]"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showClientModal && (
        <QuickClientModal
          onClose={() => setShowClientModal(false)}
          onCreated={(client) => {
            setSelectedClient(client);
            setShowClientModal(false);
          }}
        />
      )}

      {addModalCategory === "product" && (
        <AddCatalogItemModal onClose={() => setAddModalCategory(null)} onAdd={(values) => addItem("product", values)} />
      )}
      {(addModalCategory === "kit" || addModalCategory === "service") && (
        <AddCatalogBundleModal category={addModalCategory} onClose={() => setAddModalCategory(null)} onAdd={(values) => addItem(addModalCategory, values)} />
      )}

      {/* Модалка предупреждения о чёрном списке */}
      {blacklistWarningClient && (
        <BlacklistWarningModal
          client={blacklistWarningClient}
          stolenRentals={rentals.filter((r) => r.client.id === blacklistWarningClient.id && r.status === "stolen")}
          overdueRentals={rentals.filter((r) => r.client.id === blacklistWarningClient.id && r.status === "overdue")}
          onConfirm={() => {
            setSelectedClient(blacklistWarningClient);
            setBlacklistWarningClient(null);
          }}
          onCancel={() => setBlacklistWarningClient(null)}
        />
      )}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-medium text-[var(--color-text-muted)]">
        {label} {required && <span className="text-[var(--color-primary)]">*</span>}
      </span>
      {children}
    </label>
  );
}

// ─── Модальное предупреждение о чёрном списке ────────────────────────────────

function BlacklistWarningModal({
  client, stolenRentals, overdueRentals, onConfirm, onCancel,
}: {
  client: Client;
  stolenRentals: Rental[];
  overdueRentals: Rental[];
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const totalStolenAmount = stolenRentals.reduce((s, r) => s + r.total, 0);
  const totalDebt = overdueRentals.reduce((s, r) => s + Math.max(0, r.total - r.paid), 0);

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-[460px] overflow-hidden rounded-[20px] bg-white shadow-2xl">
        {/* Шапка */}
        <div className="bg-[#C0272D] px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/20">
              <Siren className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-[16px] font-bold text-white">Клиент в чёрном списке!</h3>
              <p className="text-[12.5px] text-white/80">Требуется подтверждение менеджера</p>
            </div>
          </div>
        </div>

        {/* Данные клиента */}
        <div className="border-b border-[var(--color-border)] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#FDECEC] text-[13px] font-bold text-[#C0272D]">
              {client.name.split(" ").slice(0, 2).map((n) => n[0]).join("")}
            </div>
            <div>
              <div className="text-[14px] font-bold">{client.name}</div>
              <div className="text-[12.5px] text-[var(--color-text-muted)]">{client.phone}</div>
            </div>
          </div>
        </div>

        {/* История нарушений */}
        <div className="px-6 py-4 space-y-3 max-h-[280px] overflow-y-auto">
          {stolenRentals.length > 0 && (
            <div>
              <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-[#C0272D]">
                🚨 Кражи инструмента ({stolenRentals.length})
              </p>
              <div className="space-y-1.5">
                {stolenRentals.map((r) => (
                  <div key={r.id} className="rounded-[8px] border border-[#F3B7B7] bg-[#FFF5F5] px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[12.5px] font-semibold">Аренда №{r.number}</span>
                      <span className="text-[12.5px] font-bold text-[#C0272D]">{formatMoney(r.total)}</span>
                    </div>
                    {r.items.length > 0 && (
                      <div className="mt-0.5 text-[11.5px] text-[var(--color-text-muted)]">
                        {r.items.map((i) => i.name).join(", ")}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {totalStolenAmount > 0 && (
                <p className="mt-1.5 text-right text-[12px] font-semibold text-[#C0272D]">
                  Итого украдено: {formatMoney(totalStolenAmount)}
                </p>
              )}
            </div>
          )}

          {overdueRentals.length > 0 && (
            <div>
              <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-[#B8620A]">
                ⏰ Просроченные аренды ({overdueRentals.length})
              </p>
              <div className="space-y-1.5">
                {overdueRentals.map((r) => (
                  <div key={r.id} className="rounded-[8px] border border-[#FFDCA8] bg-[#FFF8EA] px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[12.5px] font-semibold">Аренда №{r.number}</span>
                      <span className="text-[12.5px] font-bold text-[#B8620A]">
                        долг {formatMoney(Math.max(0, r.total - r.paid))}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {totalDebt > 0 && (
                <p className="mt-1.5 text-right text-[12px] font-semibold text-[#B8620A]">
                  Общий долг: {formatMoney(totalDebt)}
                </p>
              )}
            </div>
          )}

          {stolenRentals.length === 0 && overdueRentals.length === 0 && (
            <p className="text-[13px] text-[var(--color-text-muted)]">
              Клиент добавлен в чёрный список вручную. Уточните причину перед оформлением аренды.
            </p>
          )}
        </div>

        {/* Кнопки */}
        <div className="border-t border-[var(--color-border)] px-6 py-4 space-y-2">
          <p className="mb-3 text-[12.5px] text-[var(--color-text-muted)] text-center">
            Вы уверены, что хотите оформить аренду этому клиенту?
          </p>
          <button
            onClick={onConfirm}
            className="w-full rounded-[10px] border-2 border-[#C0272D] bg-white py-2.5 text-[13px] font-semibold text-[#C0272D] transition hover:bg-[#FDECEC]"
          >
            Да, оформить аренду (беру ответственность)
          </button>
          <button
            onClick={onCancel}
            className="w-full rounded-[10px] bg-[var(--color-primary)] py-2.5 text-[13px] font-semibold text-white transition hover:bg-[var(--color-primary-hover)]"
          >
            Отмена — выбрать другого клиента
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Модалка оплаты для формы новой аренды ───────────────────────────────────

type PaymentMethodNew = "cash" | "kaspi_qr" | "company";

const PM_LABELS: Record<PaymentMethodNew, string> = {
  cash: "Наличные",
  kaspi_qr: "Kaspi QR",
  company: "Оплата компаний",
};
const PM_ICONS: Record<PaymentMethodNew, React.ElementType> = {
  cash: Banknote,
  kaspi_qr: QrCode,
  company: Building2,
};

function NewRentalPaymentModal({
  remaining, onPay, onClose,
}: {
  remaining: number;
  onPay: (amount: number, method: PaymentMethodNew) => void;
  onClose: () => void;
}) {
  const [method, setMethod] = useState<PaymentMethodNew>("cash");
  const [amountStr, setAmountStr] = useState(String(remaining));
  const amount = parseFloat(amountStr.replace(/\s/g, "").replace(",", ".")) || 0;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-[380px] overflow-hidden rounded-[20px] bg-white card-shadow">
        {/* Шапка */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <h3 className="text-[15px] font-bold">Оплатить сейчас</h3>
          <button onClick={onClose} className="grid h-7 w-7 place-items-center rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Тип оплаты */}
          <div>
            <p className="mb-2 text-[12px] font-semibold text-[var(--color-text-muted)]">
              Тип оплаты <span className="text-[#C0272D]">*</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {(["company", "cash", "kaspi_qr"] as PaymentMethodNew[]).map((m) => {
                const Icon = PM_ICONS[m];
                return (
                  <button
                    key={m}
                    onClick={() => setMethod(m)}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium transition border ${
                      method === m
                        ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
                        : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {PM_LABELS[m]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Сумма */}
          <div>
            <p className="mb-1.5 text-[12px] font-semibold text-[var(--color-text-muted)]">
              Сумма оплаты <span className="text-[#C0272D]">*</span>
            </p>
            <input
              autoFocus
              type="number"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              className="crm-input text-[16px] font-semibold"
              placeholder="0"
              min={0}
            />
          </div>

          {/* Добавить способ оплаты — будет добавлено позже */}
        </div>

        {/* Кнопка */}
        <div className="border-t border-[var(--color-border)] px-5 py-4">
          <button
            onClick={() => onPay(amount, method)}
            disabled={amount <= 0}
            className="flex w-full items-center justify-center gap-2 rounded-[12px] bg-[var(--color-primary)] py-3 text-[14px] font-semibold text-white transition hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
          >
            <CreditCard className="h-4 w-4" />
            {amount > 0 ? `Принять оплату ${amount.toLocaleString("ru-RU")} ₸` : "Принять оплату"}
          </button>
        </div>
      </div>
    </div>
  );
}
