"use client";

import { use, useEffect, useRef, useState } from "react";
import { useAppStore } from "@/lib/store";
import type { Rental } from "@/lib/types";
import { notFound, useRouter } from "next/navigation";
import { RentalSidePanel } from "@/components/rentals/rental-side-panel";
import { cn, formatDateTimeDisplay, formatMoney, statusLabels, statusStyles, isOneTimeLine, lineTotal, durationDays, waLink } from "@/lib/utils";
import { useIsMobile } from "@/lib/use-is-mobile";
import { ArrowLeft, Search, Star, Phone, Mail, Plus, AlertTriangle, Pencil, MoreHorizontal, Pause, Play, History, Ban, Trash2, MessageCircle } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { RentalHistoryModal, RentalPausesModal } from "@/components/rentals/rental-history";
import { AddCatalogItemModal } from "@/components/rentals/add-catalog-item-modal";
import { AddCatalogBundleModal } from "@/components/rentals/add-catalog-bundle-modal";
import { AddShopItemModal } from "@/components/rentals/add-shop-item-modal";
import type { InventoryLine, LineCategory } from "@/lib/types";
import Link from "next/link";

const itemTabs = [
  { label: "Все", category: null },
  { label: "Продукты", category: "product" },
  { label: "Комплекты", category: "kit" },
  { label: "Услуги", category: "service" },
  { label: "Магазин", category: "shop" },
] as const;

export default function RentalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const isMobile = useIsMobile();
  const { id } = use(params);
  const rentals = useAppStore((s) => s.rentals);
  const hydrated = useAppStore((s) => s.hydrated);
  const updateRental = useAppStore((s) => s.updateRental);
  const rental = rentals.find((r) => r.id === id);
  const [activeTab, setActiveTab] = useState<(typeof itemTabs)[number]["label"]>("Все");

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

  // Даты и комментарий правятся прямо в полях: отдельная кнопка «Изменить»
  // заставляла делать лишний клик перед каждой правкой
  const [startDraft, setStartDraft] = useState("");
  const [endDraft, setEndDraft] = useState("");
  const [commentDraft, setCommentDraft] = useState("");
  const [saving, setSaving] = useState(false);

  // Клиент часто возвращается за вторым инструментом через пару часов — позиции
  // должны добавляться в уже открытую аренду, а не заводиться новой
  const [addCategory, setAddCategory] = useState<LineCategory | null>(null);
  const [addingItem, setAddingItem] = useState(false);

  // Хук обязан стоять до раннего return: иначе при первой отрисовке (аренда ещё
  // не подгрузилась) порядок хуков разъезжается и React ругается
  useEffect(() => {
    setStartDraft(toInputValue(rental?.startAt ?? ""));
    setEndDraft(toInputValue(rental?.endAt ?? ""));
    setCommentDraft(rental?.comment ?? "");
  }, [rental?.id, rental?.startAt, rental?.endAt, rental?.comment]);

  if (!rental) {
    if (!hydrated) {
      return <div className="grid h-full place-items-center text-[14.5px] text-[var(--color-text-muted)]">Загрузка…</div>;
    }
    return notFound();
  }
  const st = statusStyles[rental.status];


  // Вкладки над списком позиций теперь действительно фильтруют
  const activeCategory = itemTabs.find((t) => t.label === activeTab)?.category ?? null;
  const visibleLines = activeCategory
    ? rental.items.filter((i) => (i.category ?? "product") === activeCategory)
    : rental.items;
  // Аренда тарифицируется по суткам, услуги и товары магазина — разово
  const perDayTotal = rental.items.filter((i) => !isOneTimeLine(i)).reduce((sum, i) => sum + i.pricePerDay * i.qty, 0);
  const oneTimeTotal = rental.items.filter(isOneTimeLine).reduce((sum, i) => sum + i.pricePerDay * i.qty, 0);

  function toInputValue(iso: string) {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  /**
   * Добавляет позицию в открытую аренду и сразу поднимает счёт: повременная
   * считается за оставшийся срок, услуга и товар магазина — разово.
   */
  async function addLine(category: LineCategory, values: { name: string; pricePerDay: number; qty: number; inventoryItemId?: string; sku?: string }) {
    if (!rental) return;
    setAddCategory(null);
    setAddingItem(true);
    try {
      const line: InventoryLine = {
        id: `it_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: values.name,
        sku: values.sku ?? "",
        qty: values.qty,
        pricePerDay: values.pricePerDay,
        category,
        inventoryItemId: values.inventoryItemId,
      };
      await updateRental(rental.id, {
        items: [...rental.items, line],
        total: rental.total + lineTotal(line, durationDaysCount),
      });
    } finally {
      setAddingItem(false);
    }
  }

  /** Убирает позицию и настолько же уменьшает счёт */
  async function removeLine(line: InventoryLine) {
    if (!rental) return;
    if (!confirm(`Убрать «${line.name}» из аренды?`)) return;
    setAddingItem(true);
    try {
      await updateRental(rental.id, {
        items: rental.items.filter((i) => i.id !== line.id),
        total: Math.max(0, rental.total - lineTotal(line, durationDaysCount)),
      });
    } finally {
      setAddingItem(false);
    }
  }

  async function saveChanges() {
    if (!rental || !hasChanges) return;
    const start = new Date(startDraft);
    const end = new Date(endDraft);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      alert("Дата конца должна быть позже даты начала");
      return;
    }

    setSaving(true);
    try {
      const patch: Partial<Rental> = { comment: commentDraft };
      if (datesChanged) {
        patch.startAt = start.toISOString();
        patch.endAt = end.toISOString();
        // Продлили срок — значит клиент должен доплатить за лишние сутки.
        // Считаем именно дельту, а не сумму заново: иначе затрём ручные скидки и штрафы
        if (priceDelta !== 0) patch.total = Math.max(0, rental.total + priceDelta);
      }
      await updateRental(rental.id, patch);
    } finally {
      setSaving(false);
    }
  }

  // Расчёт длительности — общей функцией, она отбрасывает секунды
  const durationDaysCount = rental.startAt && rental.endAt ? durationDays(rental.startAt, rental.endAt) : 1;

  // Срок по черновику — он и показывается, пока правки не сохранены
  const draftDays =
    startDraft && endDraft && new Date(endDraft) > new Date(startDraft)
      ? durationDays(new Date(startDraft).toISOString(), new Date(endDraft).toISOString())
      : durationDaysCount;

  const datesChanged =
    startDraft !== toInputValue(rental.startAt ?? "") || endDraft !== toInputValue(rental.endAt ?? "");
  const commentChanged = commentDraft !== (rental.comment ?? "");
  const hasChanges = datesChanged || commentChanged;

  // Сколько добавится к счёту за изменение срока: только повременные позиции
  const extraDays = draftDays - durationDaysCount;
  const priceDelta = perDayTotal * extraDays;
  const nextTotal = Math.max(0, rental.total + priceDelta);
  const nextDue = Math.max(0, nextTotal - rental.paid);

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
              <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold", st.bg, st.text)}>
                <span className={cn("h-1.5 w-1.5 rounded-full", st.dot)} />
                {statusLabels[rental.status]}
              </span>
              {rental.pausedAt && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF4E5] px-2.5 py-1 text-[12px] font-semibold text-[#B8620A]">
                  <Pause className="h-3 w-3" /> На паузе
                </span>
              )}
            </div>
            <p className="text-[13.5px] text-[var(--color-text-muted)]">{rental.branch}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canEdit && hasChanges && (
            <button
              onClick={saveChanges}
              disabled={saving}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-[10px] bg-[var(--color-primary)] px-4 py-2 text-[14px] font-semibold text-[var(--color-on-primary)] shadow-[var(--shadow-primary)] transition hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
            >
              {saving ? "Сохраняем…" : "Сохранить изменения"}
            </button>
          )}
          <div ref={menuRef} className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Действия с арендой"
              className="grid h-9 w-9 place-items-center rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary-ink)]"
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
                "flex items-center gap-1.5 whitespace-nowrap rounded-[10px] px-4 py-2 text-[14px] font-semibold transition disabled:opacity-50",
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

      {addCategory === "product" && (
        <AddCatalogItemModal onClose={() => setAddCategory(null)} onAdd={(v) => addLine("product", v)} />
      )}
      {(addCategory === "kit" || addCategory === "service") && (
        <AddCatalogBundleModal
          category={addCategory}
          onClose={() => setAddCategory(null)}
          onAdd={(v) => addLine(addCategory, v)}
        />
      )}
      {addCategory === "shop" && (
        <AddShopItemModal onClose={() => setAddCategory(null)} onAdd={(v) => addLine("shop", v)} />
      )}

      <div className={cn("flex flex-1 gap-5 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5", isMobile && "flex-col")}>
        {/* LEFT: main form */}
        <div className="min-w-0 flex-1 space-y-4">
          {/* Client block */}
          <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 card-shadow">
            <h2 className="mb-3 text-[15px] font-semibold">Клиент</h2>
            <div className="flex items-start gap-4">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[var(--color-primary-soft)] text-[17px] font-bold text-[var(--color-primary-ink)]">
                {rental.client.name.split(" ").slice(0, 2).map((n) => n[0]).join("")}
              </div>
              <div className="grid flex-1 grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
                <div>
                  <div className="text-[13px] text-[var(--color-text-muted)]">ФИО</div>
                  <div className="text-[14.5px] font-semibold">{rental.client.name}</div>
                </div>
                <div>
                  <div className="text-[13px] text-[var(--color-text-muted)]">Телефон</div>
                  <div className="flex items-center gap-2 text-[14.5px] font-medium">
                    <span className="flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5 text-[var(--color-text-muted)]" /> {rental.client.phone}
                    </span>
                    {/* Написать клиенту — самое частое действие после звонка, пусть будет под рукой */}
                    {waLink(rental.client.phone, `Здравствуйте, ${rental.client.name}! Пишем по аренде №${rental.number}.`) && (
                      <a
                        href={waLink(rental.client.phone, `Здравствуйте, ${rental.client.name}! Пишем по аренде №${rental.number}.`)!}
                        target="_blank"
                        rel="noopener"
                        title="Написать в WhatsApp"
                        className="flex items-center gap-1 rounded-[8px] bg-[#25D366] px-2 py-1 text-[12.5px] font-semibold text-white transition hover:brightness-95"
                      >
                        <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                      </a>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-[13px] text-[var(--color-text-muted)]">Email</div>
                  <div className="flex items-center gap-1 text-[14.5px] font-medium">
                    <Mail className="h-3.5 w-3.5 text-[var(--color-text-muted)]" /> {rental.client.email}
                  </div>
                </div>
                <div>
                  <div className="text-[13px] text-[var(--color-text-muted)]">Рейтинг клиента</div>
                  <div className="flex items-center gap-1 text-[14.5px] font-medium">
                    <Star className="h-3.5 w-3.5 fill-[#F59E0B] text-[#F59E0B]" /> {rental.client.rating}
                  </div>
                </div>
                <div>
                  <div className="text-[13px] text-[var(--color-text-muted)]">История аренд</div>
                  <div className="text-[14.5px] font-medium">{rental.client.totalRentals} аренд · {formatMoney(rental.client.totalSpent)}</div>
                </div>
                <div>
                  <div className="text-[13px] text-[var(--color-text-muted)]">Скидка</div>
                  <div className="text-[14.5px] font-medium">
                    {rental.client.discount ? `${rental.client.discount}%` : "—"}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Rental fields */}
          <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 card-shadow">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[16px] font-semibold">Аренда</h2>
              {datesChanged && (
                <span className="text-[13px] font-medium text-[var(--color-primary-ink)]">Срок изменён — не забудьте сохранить</span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {canEdit ? (
                <>
                  <label className="block">
                    <span className="mb-1 block text-[13px] text-[var(--color-text-muted)]">Дата начала</span>
                    <input
                      type="datetime-local"
                      value={startDraft}
                      onChange={(e) => setStartDraft(e.target.value)}
                      className={cn(
                        "w-full rounded-[10px] border px-3 py-2 text-[15px] outline-none transition focus:border-[var(--color-primary)]",
                        datesChanged ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)]" : "border-transparent bg-[var(--color-bg)]"
                      )}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[13px] text-[var(--color-text-muted)]">Дата конца</span>
                    <input
                      type="datetime-local"
                      value={endDraft}
                      onChange={(e) => setEndDraft(e.target.value)}
                      className={cn(
                        "w-full rounded-[10px] border px-3 py-2 text-[15px] outline-none transition focus:border-[var(--color-primary)]",
                        datesChanged ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)]" : "border-transparent bg-[var(--color-bg)]"
                      )}
                    />
                  </label>
                  <div>
                    <span className="mb-1 block text-[13px] text-[var(--color-text-muted)]">Продолжительность</span>
                    <div className="rounded-[10px] bg-[var(--color-bg)] px-3 py-2 text-[15px]">{draftDays} сут.</div>
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

            {/* Продление срока — это деньги: показываем доплату сразу, до сохранения */}
            {datesChanged && extraDays !== 0 && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-[var(--color-primary)] bg-[var(--color-primary-soft)] px-3.5 py-3">
                <div>
                  <div className="text-[14px] font-semibold text-[var(--color-primary-ink)]">
                    {extraDays > 0
                      ? `Продление на ${extraDays} сут. — доплата ${formatMoney(priceDelta)}`
                      : `Срок сокращён на ${-extraDays} сут. — сумма уменьшится на ${formatMoney(-priceDelta)}`}
                  </div>
                  <div className="text-[13px] text-[var(--color-text-muted)]">
                    Ставка {formatMoney(perDayTotal)} / сут · сумма аренды станет {formatMoney(nextTotal)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[13px] text-[var(--color-text-muted)]">К оплате после изменения</div>
                  <div className="text-[17px] font-bold">{formatMoney(nextDue)}</div>
                </div>
              </div>
            )}

            <div className="mt-4">
              <span className="mb-1 block text-[13px] text-[var(--color-text-muted)]">Комментарий</span>
              {canEdit ? (
                <textarea
                  value={commentDraft}
                  onChange={(e) => setCommentDraft(e.target.value)}
                  rows={2}
                  className={cn(
                    "w-full resize-none rounded-[10px] border px-3 py-2 text-[14px] outline-none transition focus:border-[var(--color-primary)]",
                    commentChanged ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)]" : "border-transparent bg-[var(--color-bg)]"
                  )}
                  placeholder="Комментарий к аренде…"
                />
              ) : (
                <div className="rounded-[10px] bg-[var(--color-bg)] px-3 py-2 text-[14px]">{rental.comment || "Без комментария"}</div>
              )}
            </div>
          </section>

          {/* Items */}
          <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 card-shadow">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-1 rounded-[10px] bg-[var(--color-bg)] p-1">
                {itemTabs.map((t) => (
                  <button
                    key={t.label}
                    onClick={() => setActiveTab(t.label)}
                    className={cn(
                      "rounded-[8px] px-3 py-1.5 text-[13.5px] font-semibold transition",
                      activeTab === t.label ? "bg-[var(--color-surface)] text-[var(--color-primary-ink)] shadow-sm" : "text-[var(--color-text-muted)]"
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-text-muted)]" />
                <input
                  placeholder="Найти товар…"
                  className="w-52 rounded-[10px] border border-[var(--color-border)] py-1.5 pl-8 pr-3 text-[13.5px] outline-none focus:border-[var(--color-primary)]"
                />
              </div>
            </div>

            <div className="space-y-2">
              {visibleLines.length === 0 && (
                <p className="py-4 text-center text-[13.5px] text-[var(--color-text-muted)]">В этой категории пусто</p>
              )}
              {visibleLines.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-[10px] border border-[var(--color-border)] px-3 py-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    {item.flagged && <AlertTriangle className="h-4 w-4 shrink-0 text-[#EF4444]" />}
                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-medium">{item.name}</div>
                      <div className="text-[12.5px] text-[var(--color-text-muted)]">{item.sku} · {item.qty} шт</div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-[14px] font-semibold">
                      {formatMoney(item.pricePerDay)}
                      {isOneTimeLine(item) ? " за шт." : " / сутки"}
                    </span>
                    {canEdit && rental.status !== "cancelled" && (
                      <button
                        onClick={() => removeLine(item)}
                        disabled={addingItem}
                        className="grid h-6 w-6 place-items-center rounded-md text-[var(--color-text-muted)] transition hover:bg-[#FDECEC] hover:text-[#C0272D] disabled:opacity-40"
                        title="Убрать из аренды"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {canEdit && rental.status !== "cancelled" && (
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(
                  [
                    { key: "product", label: "Товар" },
                    { key: "kit", label: "Комплект" },
                    { key: "service", label: "Услугу" },
                    { key: "shop", label: "Из магазина" },
                  ] as { key: LineCategory; label: string }[]
                ).map((o) => (
                  <button
                    key={o.key}
                    onClick={() => setAddCategory(o.key)}
                    disabled={addingItem}
                    className="flex items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-[var(--color-border)] py-2 text-[13.5px] font-medium text-[var(--color-text-muted)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary-ink)] disabled:opacity-50"
                  >
                    <Plus className="h-3.5 w-3.5" /> {o.label}
                  </button>
                ))}
              </div>
            )}

            <div className="mt-4 space-y-1.5 border-t border-[var(--color-border)] pt-3">
              <div className="flex items-center justify-between">
                <span className="text-[14px] text-[var(--color-text-muted)]">Аренда за сутки</span>
                <span className="text-[17px] font-bold">{formatMoney(perDayTotal)}</span>
              </div>
              {oneTimeTotal > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-[14px] text-[var(--color-text-muted)]">Разово (услуги и магазин)</span>
                  <span className="text-[14.5px] font-semibold">{formatMoney(oneTimeTotal)}</span>
                </div>
              )}
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
      <div className="mb-1 text-[13px] text-[var(--color-text-muted)]">{label}</div>
      <div className="rounded-[10px] bg-[var(--color-bg)] px-3 py-2 text-[14px] font-medium">{value}</div>
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
        "flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[14px] font-medium transition hover:bg-[var(--color-bg)]",
        danger ? "text-[#C0272D]" : "text-[var(--color-text)]"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </button>
  );
}
