"use client";

import { Rental } from "@/lib/types";
import {
  cn,
  formatDateTimeDisplay,
  formatMoney,
  paymentLabels,
  paymentStyles,
  statusLabels,
  statusHeaderStyles,
  DEBTOR_HEADER,
  isOneTimeLine,
  isDebtorRental,
} from "@/lib/utils";
import { Phone, Truck, ChevronDown, AlertTriangle, History, Copy } from "lucide-react";
import Link from "next/link";
import { SelectBox } from "@/components/common/selection-bar";

export function RentalCard({
  rental,
  draggable,
  selectable,
  selected,
  onToggleSelect,
}: {
  rental: Rental;
  draggable?: boolean;
  /** Включён режим массового выбора: карточка не открывается, а отмечается */
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}) {
  const st = statusHeaderStyles[rental.status];
  const pay = paymentStyles[rental.paymentStatus];

  // «Должник» — закрытая аренда с долгом: инструмент вернули, а деньги нет.
  // Пока аренда идёт, виден её статус и неоплаченный остаток отдельной строкой
  const debtor = isDebtorRental(rental);
  const headerBg = debtor ? DEBTOR_HEADER : st.header;
  const label = debtor ? "Должник" : statusLabels[rental.status];
  const chipText = debtor ? "text-[#C23A16]" : st.chip;

  const className = cn(
    "group block overflow-hidden rounded-[var(--radius-card)] border bg-[var(--color-surface)] card-shadow card-shadow-hover transition-all duration-200",
    selectable ? "cursor-pointer" : "hover:-translate-y-[2px]",
    selected ? "border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/40" : "border-[var(--color-border)]"
  );

  const body = (
    <>
      {/* Цветная шапка: статус, даты и клиент — всё, что видно с расстояния */}
      <div className={cn("p-3.5 text-white", headerBg)}>
        <div className="flex items-start justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2">
            {selectable && <SelectBox checked={!!selected} className="border-white/70 bg-white/20" />}
            <span className={cn("truncate rounded-full bg-white px-2.5 py-1 text-[12.5px] font-bold", chipText)}>
              {label}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1 text-[13.5px] font-semibold text-white/90">
            <Copy className="h-3.5 w-3.5" />№{rental.number}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className={cn("rounded-[10px] px-2.5 py-1.5", st.tile)}>
            <div className="flex items-center gap-1 text-[11.5px] font-medium text-white/85">
              Дата начала <History className="h-2.5 w-2.5" />
            </div>
            <div className="text-[13.5px] font-bold">{formatDateTimeDisplay(rental.startAt ?? "") || "—"}</div>
          </div>
          <div className={cn("rounded-[10px] px-2.5 py-1.5", st.tile)}>
            <div className="flex items-center gap-1 text-[11.5px] font-medium text-white/85">
              Дата конца <History className="h-2.5 w-2.5" />
            </div>
            <div className="text-[13.5px] font-bold">{formatDateTimeDisplay(rental.endAt ?? "") || "—"}</div>
          </div>
        </div>

        <div className={cn("mt-2 flex items-center gap-2.5 rounded-[10px] px-2.5 py-2", st.tile)}>
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/85 text-[12px] font-bold text-[#3B2E4A]">
            {rental.client.name
              .split(" ")
              .slice(0, 2)
              .map((n) => n[0])
              .join("")}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[14.5px] font-bold">{rental.client.name}</div>
            <div className="flex items-center gap-1 text-[12.5px] text-white/85">
              <Phone className="h-3 w-3" /> {rental.client.phone}
            </div>
          </div>
          {rental.delivery && (
            <span className="ml-auto grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/25" title="Доставка">
              <Truck className="h-3.5 w-3.5" />
            </span>
          )}
        </div>
      </div>

      {/* Белый низ: деньги и состав */}
      <div className="p-4">
        <div className="flex items-center justify-between text-[14px]">
          <span className="font-semibold">Общая сумма</span>
          <span className="font-bold">{formatMoney(rental.total)}</span>
        </div>
        <div className="mt-0.5 flex items-center justify-between text-[13.5px]">
          <span className="text-[var(--color-text-muted)]">Сумма аренды</span>
          <span className="font-medium">{formatMoney(rental.total)}</span>
        </div>

        <div className={cn("mt-2.5 rounded-[10px] px-2.5 py-2 text-center text-[13.5px] font-semibold", pay.bg, pay.text)}>
          {rental.paymentStatus === "pending" || rental.paymentStatus === "overdue"
            ? `${paymentLabels[rental.paymentStatus]} (${formatMoney(rental.total - rental.paid)})`
            : paymentLabels[rental.paymentStatus]}
        </div>

        <div className="mt-3 rounded-[10px] border border-[var(--color-border)] px-2.5 py-2">
          <div className="mb-1 text-[12px] font-semibold">
            {/* Ставка за сутки: услуги и товары магазина сюда не входят, они разовые */}
            Инвентарь ({formatMoney(rental.items.filter((i) => !isOneTimeLine(i)).reduce((s, i) => s + i.pricePerDay * i.qty, 0))} / сут)
          </div>
          {rental.items.slice(0, 2).map((item) => (
            <div key={item.id} className="flex items-center gap-1.5 py-0.5 text-[13px]">
              {item.flagged && <AlertTriangle className="h-3 w-3 shrink-0 text-[#EF4444]" />}
              <span className="truncate text-[var(--color-primary-ink)]">{item.name}</span>
              <span className="ml-auto shrink-0 text-[var(--color-text-muted)]">({item.sku})</span>
            </div>
          ))}
          {rental.items.length === 0 && (
            <div className="text-[12.5px] text-[var(--color-text-muted)]">Позиции не добавлены</div>
          )}
          {rental.items.length > 2 && (
            <div className="text-[12px] text-[var(--color-text-muted)]">+{rental.items.length - 2} ещё</div>
          )}
        </div>

        <div className="mt-2.5 flex items-center justify-between text-[12.5px]">
          <div>
            <div className="text-[var(--color-text-muted)]">Оформил</div>
            <div className="font-medium">{rental.bookedBy.name.split(" ").slice(-2).join(" ")}</div>
          </div>
          <div className="text-right">
            <div className="text-[var(--color-text-muted)]">Выдал</div>
            <div className="font-medium">{rental.issuedBy?.name.split(" ").slice(-2).join(" ") || "—"}</div>
          </div>
        </div>

        <button className="mt-3 flex w-full items-center justify-between rounded-[10px] border border-[var(--color-border)] px-2.5 py-2 text-[13px] font-medium text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg)]">
          Документ
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>
    </>
  );

  // В режиме выбора ссылка мешала бы: клик должен отмечать карточку, а не уводить со страницы
  if (selectable) {
    return (
      <div role="button" tabIndex={0} onClick={onToggleSelect} className={className}>
        {body}
      </div>
    );
  }

  return (
    <Link href={`/rentals/${rental.id}`} draggable={draggable} className={className}>
      {body}
    </Link>
  );
}
