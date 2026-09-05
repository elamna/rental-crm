"use client";

import { use, useEffect, useRef, useState } from "react";
import { useAppStore } from "@/lib/store";
import { notFound, useRouter } from "next/navigation";
import { RentalSidePanel } from "@/components/rentals/rental-side-panel";
import { cn, formatDateTimeDisplay, formatMoney, statusLabels, statusStyles } from "@/lib/utils";
import { useIsMobile } from "@/lib/use-is-mobile";
import { ArrowLeft, Search, Star, Phone, Mail, Plus, AlertTriangle, Pencil, MoreHorizontal, Pause, Play, History, Ban, Trash2 } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { RentalHistoryModal, RentalPausesModal } from "@/components/rentals/rental-history";
import Link from "next/link";

const itemTabs = ["Все", "Продукты", "Комплекты", "Услуги"] as const;

export default function RentalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const isMobile = useIsMobile();
  const { id } = use(params);
  const rentals = useAppStore((s) => s.rentals);
  const hydrated = useAppStore((s) => s.hydrated);
  const updateRental = useAppStore((s) => s.updateRental);
  const rental = rentals.find((r) => r.id === id);
  const [activeTab, setActiveTab] = useState<(typeof itemTabs)[number]>("Все");

  const router = useRouter();
  const { can } = useAuth();
  const canEdit = can("rentals.edit");
  const hydrate = useAppStore((s) => s.hydrate);

  // Пауза, история и меню действий
  const [menuOpen, setMenuOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showPauses, setShowPauses] = useState(false);
  const [pauseBusy, setPauseBusy] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen]);

  /** Перечитываем стор: пауза и откат меняют аренду на сервере */
  async function reloadRentals() {
    useAppStore.setState({ hydrated: false, hydrating: false });
    await hydrate();
  }

  async function togglePause(paused: boolean) {
    setPauseBusy(true);
    const res = await fetch(`/api/rentals/${id}/pauses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: paused ? "resume" : "pause" }),
    });
    if (!res.ok) alert("Не удалось изменить паузу");
    await reloadRentals();
    setPauseBusy(false);
  }

  async function cancelRental() {
    if (!confirm("Отменить аренду? Инвентарь вернётся в каталог как свободный.")) return;
    setMenuOpen(false);
    await updateRental(id, { status: "cancelled" });
  }

  async function removeRental() {
    if (!confirm("Удалить аренду безвозвратно? Вместе с ней исчезнут её документы и история.")) return;
    setMenuOpen(false);
    const res = await fetch(`/api/rentals/${id}`, { method: "DELETE" });
    if (!res.ok) {
      alert("Не удалось удалить аренду");
      return;
    }
    await reloadRentals();
    router.push("/rentals");
  }

  // Редактирование дат
  const [editingDates, setEditingDates] = useState(false);
  const [startDraft, setStartDraft] = useState("");
  const [endDraft, setEndDraft] = useState("");
  const [savingDates, setSavingDates] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [editingComment, setEditingComment] = useState(false);
  const [savingComment, setSavingComment] = useState(false);

  if (!rental) {
    if (!hydrated) {
      return <div className="grid h-full place-items-center text-[13.5px] text-[var(--color-text-muted)]">Загрузка…</div>;
    }
    return notFound();
  }
  const st = statusStyles[rental.status];

  function toInputValue(iso: string) {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function startEditDates() {
    if (!rental) return;
    setStartDraft(toInputValue(rental.startAt ?? ""));
    setEndDraft(toInputValue(rental.endAt ?? ""));
    setEditingDates(true);
  }

  async function saveDates() {
    if (!rental || !startDraft || !endDraft) return;
    const start = new Date(startDraft);
    const end = new Date(endDraft);
    if (end <= start) {
      alert("Дата конца должна быть позже даты начала");
      return;
    }
    setSavingDates(true);
    try {
      await updateRental(rental.id, {
        startAt: start.toISOString(),
        endAt: end.toISOString(),
      });
      setEditingDates(false);
    } finally {
      setSavingDates(false);
    }
  }

  async function saveComment() {
    if (!rental) return;
    setSavingComment(true);
    try {
      await updateRental(rental.id, { comment: commentDraft });
      setEditingComment(false);
    } finally {
      setSavingComment(false);
    }
  }

  // Расчёт длительности
  const durationDaysCount = rental.startAt && rental.endAt
    ? Math.max(1, Math.ceil((new Date(rental.endAt).getTime() - new Date(rental.startAt).getTime()) / 86400000))
    : 1;

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]/70 px-4 py-3 backdrop-blur sm:px-6 sm:py-4">
        <div className="flex items-center gap-3">
          <Link href="/rentals" className="grid h-8 w-8 place-items-center rounded-[10px] border border-[var(--color-border)] transition hover:bg-[var(--color-bg)]">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-[18px] font-bold">Аренда №{rental.number}</h1>
              <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold", st.bg, st.text)}>
                <span className={cn("h-1.5 w-1.5 rounded-full", st.dot)} />
                {statusLabels[rental.status]}
              </span>
              {rental.pausedAt && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF4E5] px-2.5 py-1 text-[11px] font-semibold text-[#B8620A]">
                  <Pause className="h-3 w-3" /> На паузе
                </span>
              )}
            </div>
            <p className="text-[12.5px] text-[var(--color-text-muted)]">{rental.branch}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div ref={menuRef} className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Действия с арендой"
              className="grid h-9 w-9 place-items-center rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>

            {menuOpen && (
              <div className="absolute left-0 z-40 mt-2 w-[230px] overflow-hidden rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-xl md:left-auto md:right-0">
                <MenuItem icon={History} label="История аренды" onClick={() => { setMenuOpen(false); setShowHistory(true); }} />
                <MenuItem icon={Pause} label="История пауз" onClick={() => { setMenuOpen(false); setShowPauses(true); }} />
                {canEdit && rental.status !== "cancelled" && (
                  <MenuItem icon={Ban} label="Отменить аренду" onClick={cancelRental} />
                )}
                {canEdit && <MenuItem icon={Trash2} label="Удалить аренду" danger onClick={removeRental} />}
              </div>
            )}
          </div>

          {canEdit && (rental.status === "active" || rental.status === "overdue" || rental.pausedAt) && (
            <button
              onClick={() => togglePause(!!rental.pausedAt)}
              disabled={pauseBusy}
              className={cn(
                "flex items-center gap-1.5 whitespace-nowrap rounded-[10px] px-4 py-2 text-[13px] font-semibold transition disabled:opacity-50",
                rental.pausedAt
                  ? "bg-[#1C8A46] text-white hover:bg-[#167A3C]"
                  : "bg-[#FFF4E5] text-[#B8620A] hover:bg-[#FFE9CC]"
              )}
            >
              {rental.pausedAt ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
              {rental.pausedAt ? "Снять с паузы" : "Поставить на паузу"}
            </button>
          )}
        </div>
      </header>

      {showHistory && (
        <RentalHistoryModal rentalId={id} canEdit={canEdit} onClose={() => setShowHistory(false)} onReverted={reloadRentals} />
      )}
      {showPauses && <RentalPausesModal rentalId={id} onClose={() => setShowPauses(false)} />}

      <div className={cn("flex flex-1 gap-5 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5", isMobile && "flex-col")}>
        {/* LEFT: main form */}
        <div className="min-w-0 flex-1 space-y-4">
          {/* Client block */}
          <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 card-shadow">
            <h2 className="mb-3 text-[14px] font-semibold">Клиент</h2>
            <div className="flex items-start gap-4">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[var(--color-primary-soft)] text-[16px] font-bold text-[var(--color-primary)]">
                {rental.client.name.split(" ").slice(0, 2).map((n) => n[0]).join("")}
              </div>
              <div className="grid flex-1 grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
                <div>
                  <div className="text-[12px] text-[var(--color-text-muted)]">ФИО</div>
                  <div className="text-[13.5px] font-semibold">{rental.client.name}</div>
                </div>
                <div>
                  <div className="text-[12px] text-[var(--color-text-muted)]">Телефон</div>
                  <div className="flex items-center gap-1 text-[13.5px] font-medium">
                    <Phone className="h-3.5 w-3.5 text-[var(--color-text-muted)]" /> {rental.client.phone}
                  </div>
                </div>
                <div>
                  <div className="text-[12px] text-[var(--color-text-muted)]">Email</div>
                  <div className="flex items-center gap-1 text-[13.5px] font-medium">
                    <Mail className="h-3.5 w-3.5 text-[var(--color-text-muted)]" /> {rental.client.email}
                  </div>
                </div>
                <div>
                  <div className="text-[12px] text-[var(--color-text-muted)]">Рейтинг клиента</div>
                  <div className="flex items-center gap-1 text-[13.5px] font-medium">
                    <Star className="h-3.5 w-3.5 fill-[#F59E0B] text-[#F59E0B]" /> {rental.client.rating}
                  </div>
                </div>
                <div>
                  <div className="text-[12px] text-[var(--color-text-muted)]">История аренд</div>
                  <div className="text-[13.5px] font-medium">{rental.client.totalRentals} аренд · {formatMoney(rental.client.totalSpent)}</div>
                </div>
                <div>
                  <div className="text-[12px] text-[var(--color-text-muted)]">Скидка</div>
                  <div className="text-[13.5px] font-medium">
                    {rental.client.discount ? `${rental.client.discount}%` : "—"}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Rental fields */}
          <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 card-shadow">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[14px] font-semibold">Аренда</h2>
              {!editingDates ? (
                <button
                  onClick={startEditDates}
                  className="flex items-center gap-1.5 rounded-[8px] border border-[var(--color-border)] px-3 py-1.5 text-[12px] font-medium text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg)] hover:text-[var(--color-primary)]"
                >
                  <Pencil className="h-3.5 w-3.5" /> Изменить даты
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingDates(false)}
                    disabled={savingDates}
                    className="rounded-[8px] border border-[var(--color-border)] px-3 py-1.5 text-[12px] font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={saveDates}
                    disabled={savingDates}
                    className="rounded-[8px] bg-[var(--color-primary)] px-3 py-1.5 text-[12px] font-semibold text-[var(--color-on-primary)] hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
                  >
                    {savingDates ? "Сохранение…" : "Сохранить"}
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {editingDates ? (
                <>
                  <label className="block">
                    <span className="mb-1 block text-[12px] text-[var(--color-text-muted)]">Дата начала</span>
                    <input
                      type="datetime-local"
                      value={startDraft}
                      onChange={(e) => setStartDraft(e.target.value)}
                      className="w-full rounded-[10px] border border-[var(--color-primary)] px-3 py-2 text-[13px] outline-none"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[12px] text-[var(--color-text-muted)]">Дата конца</span>
                    <input
                      type="datetime-local"
                      value={endDraft}
                      onChange={(e) => setEndDraft(e.target.value)}
                      className="w-full rounded-[10px] border border-[var(--color-primary)] px-3 py-2 text-[13px] outline-none"
                    />
                  </label>
                  <div>
                    <span className="mb-1 block text-[12px] text-[var(--color-text-muted)]">Продолжительность</span>
                    <div className="rounded-[10px] bg-[var(--color-bg)] px-3 py-2 text-[13px]">
                      {startDraft && endDraft
                        ? `${Math.max(1, Math.ceil((new Date(endDraft).getTime() - new Date(startDraft).getTime()) / 86400000))} сут.`
                        : "—"}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <Field label="Дата начала" value={formatDateTimeDisplay(rental.startAt ?? "") || "—"} />
                  <Field label="Дата конца" value={formatDateTimeDisplay(rental.endAt ?? "") || "—"} />
                  <Field label="Продолжительность" value={`${durationDaysCount} сут.`} />
                </>
              )}
              <Field label="Период аренды" value="Посуточно" />
              <Field label="Филиал" value={rental.branch} />
              <Field label="Менеджер" value={rental.bookedBy.name} />
            </div>

            <div className="mt-4">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[12px] text-[var(--color-text-muted)]">Комментарий</span>
                {!editingComment ? (
                  <button
                    onClick={() => { setCommentDraft(rental.comment ?? ""); setEditingComment(true); }}
                    className="text-[11.5px] font-medium text-[var(--color-primary)] hover:underline"
                  >
                    Изменить
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => setEditingComment(false)} className="text-[11.5px] text-[var(--color-text-muted)] hover:underline">Отмена</button>
                    <button onClick={saveComment} disabled={savingComment} className="text-[11.5px] font-medium text-[var(--color-primary)] hover:underline disabled:opacity-50">
                      {savingComment ? "Сохранение…" : "Сохранить"}
                    </button>
                  </div>
                )}
              </div>
              {editingComment ? (
                <textarea
                  autoFocus
                  value={commentDraft}
                  onChange={(e) => setCommentDraft(e.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-[10px] border border-[var(--color-primary)] px-3 py-2 text-[13px] outline-none"
                  placeholder="Комментарий к аренде…"
                />
              ) : (
                <div className="rounded-[10px] bg-[var(--color-bg)] px-3 py-2 text-[13px]">
                  {rental.comment || "Без комментария"}
                </div>
              )}
            </div>
          </section>

          {/* Items */}
          <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 card-shadow">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-1 rounded-[10px] bg-[var(--color-bg)] p-1">
                {itemTabs.map((t) => (
                  <button
                    key={t}
                    onClick={() => setActiveTab(t)}
                    className={cn(
                      "rounded-[8px] px-3 py-1.5 text-[12.5px] font-semibold transition",
                      activeTab === t ? "bg-[var(--color-surface)] text-[var(--color-primary)] shadow-sm" : "text-[var(--color-text-muted)]"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-text-muted)]" />
                <input
                  placeholder="Найти товар…"
                  className="w-52 rounded-[10px] border border-[var(--color-border)] py-1.5 pl-8 pr-3 text-[12.5px] outline-none focus:border-[var(--color-primary)]"
                />
              </div>
            </div>

            <div className="space-y-2">
              {rental.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-[10px] border border-[var(--color-border)] px-3 py-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    {item.flagged && <AlertTriangle className="h-4 w-4 shrink-0 text-[#EF4444]" />}
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-medium">{item.name}</div>
                      <div className="text-[11.5px] text-[var(--color-text-muted)]">{item.sku} · {item.qty} шт</div>
                    </div>
                  </div>
                  <div className="shrink-0 text-[13px] font-semibold">{formatMoney(item.pricePerDay)} / сутки</div>
                </div>
              ))}
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <button className="flex items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-[var(--color-border)] py-2 text-[12.5px] font-medium text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg)]">
                <Plus className="h-3.5 w-3.5" /> Добавить товар
              </button>
              <button className="flex items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-[var(--color-border)] py-2 text-[12.5px] font-medium text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg)]">
                <Plus className="h-3.5 w-3.5" /> Добавить комплект
              </button>
              <button className="flex items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-[var(--color-border)] py-2 text-[12.5px] font-medium text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg)]">
                <Plus className="h-3.5 w-3.5" /> Добавить услугу
              </button>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-[var(--color-border)] pt-3">
              <span className="text-[13px] text-[var(--color-text-muted)]">Итого за сутки</span>
              <span className="text-[16px] font-bold">
                {formatMoney(rental.items.reduce((s, i) => s + i.pricePerDay, 0))}
              </span>
            </div>
          </section>
        </div>

        {/* RIGHT: pinned side panel */}
        <RentalSidePanel rental={rental} />
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-1 text-[12px] text-[var(--color-text-muted)]">{label}</div>
      <div className="rounded-[10px] bg-[var(--color-bg)] px-3 py-2 text-[13px] font-medium">{value}</div>
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13px] font-medium transition hover:bg-[var(--color-bg)]",
        danger ? "text-[#C0272D]" : "text-[var(--color-text)]"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </button>
  );
}
