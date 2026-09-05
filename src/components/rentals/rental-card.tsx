"use client";

import { Rental } from "@/lib/types";
import { cn, formatDateTimeDisplay, formatMoney, paymentLabels, paymentStyles, statusLabels, statusStyles } from "@/lib/utils";
import { Phone, Truck, ChevronDown, AlertTriangle } from "lucide-react";
import Link from "next/link";

export function RentalCard({ rental, draggable }: { rental: Rental; draggable?: boolean }) {
  const st = statusStyles[rental.status];
  const pay = paymentStyles[rental.paymentStatus];

  return (
    <Link
      href={`/rentals/${rental.id}`}
      draggable={draggable}
      className={cn(
        "group block rounded-[var(--radius-card)] border bg-[var(--color-surface)] p-4 card-shadow card-shadow-hover transition-all duration-200 hover:-translate-y-[2px]",
        st.border
      )}
    >
      <div className="flex items-start justify-between">
        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold", st.bg, st.text)}>
          <span className={cn("h-1.5 w-1.5 rounded-full", st.dot)} />
          {statusLabels[rental.status]}
        </span>
        <span className="text-[12px] font-medium text-[var(--color-text-muted)]">№{rental.number}</span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-[10px] bg-[var(--color-bg)] px-2.5 py-1.5">
          <div className="text-[10px] font-medium text-[var(--color-text-muted)]">Дата начала</div>
          <div className="text-[12.5px] font-semibold">{formatDateTimeDisplay(rental.startAt ?? "") || "—"}</div>
        </div>
        <div className="rounded-[10px] bg-[var(--color-bg)] px-2.5 py-1.5">
          <div className="text-[10px] font-medium text-[var(--color-text-muted)]">Дата конца</div>
          <div className="text-[12.5px] font-semibold">{formatDateTimeDisplay(rental.endAt ?? "") || "—"}</div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2.5">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--color-primary-soft)] text-[11px] font-bold text-[var(--color-primary)]">
          {rental.client.name
            .split(" ")
            .slice(0, 2)
            .map((n) => n[0])
            .join("")}
        </div>
        <div className="min-w-0">
          <div className="truncate text-[13.5px] font-semibold">{rental.client.name}</div>
          <div className="flex items-center gap-1 text-[11.5px] text-[var(--color-text-muted)]">
            <Phone className="h-3 w-3" /> {rental.client.phone}
          </div>
        </div>
        {rental.delivery && (
          <span className="ml-auto grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--color-bg)] text-[var(--color-text-muted)]" title="Доставка">
            <Truck className="h-3.5 w-3.5" />
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between text-[12.5px]">
        <span className="text-[var(--color-text-muted)]">Общая сумма</span>
        <span className="font-semibold">{formatMoney(rental.total)}</span>
      </div>
      <div className="flex items-center justify-between text-[12.5px]">
        <span className="text-[var(--color-text-muted)]">Сумма аренды</span>
        <span className="font-semibold">{formatMoney(rental.total)}</span>
      </div>

      <div className={cn("mt-2.5 rounded-[10px] px-2.5 py-1.5 text-center text-[12px] font-semibold", pay.bg, pay.text)}>
        {rental.paymentStatus === "pending" || rental.paymentStatus === "overdue"
          ? `${paymentLabels[rental.paymentStatus]} (${formatMoney(rental.total - rental.paid)})`
          : paymentLabels[rental.paymentStatus]}
      </div>

      <div className="mt-3 rounded-[10px] border border-[var(--color-border)] px-2.5 py-2">
        <div className="mb-1 text-[10px] font-medium text-[var(--color-text-muted)]">
          Инвентарь ({formatMoney(rental.items.reduce((s, i) => s + i.pricePerDay, 0))})
        </div>
        {rental.items.slice(0, 2).map((item) => (
          <div key={item.id} className="flex items-center gap-1.5 py-0.5 text-[12px]">
            {item.flagged && <AlertTriangle className="h-3 w-3 shrink-0 text-[#EF4444]" />}
            <span className="truncate text-[var(--color-primary)]">{item.name}</span>
            <span className="ml-auto shrink-0 text-[var(--color-text-muted)]">({item.sku})</span>
          </div>
        ))}
        {rental.items.length > 2 && (
          <div className="text-[11px] text-[var(--color-text-muted)]">+{rental.items.length - 2} ещё</div>
        )}
      </div>

      <div className="mt-2.5 flex items-center justify-between text-[11.5px]">
        <div>
          <div className="text-[var(--color-text-muted)]">Оформил</div>
          <div className="font-medium">{rental.bookedBy.name.split(" ").slice(-2).join(" ")}</div>
        </div>
        <div className="text-right">
          <div className="text-[var(--color-text-muted)]">Выдал</div>
          <div className="font-medium">{rental.issuedBy?.name.split(" ").slice(-2).join(" ")}</div>
        </div>
      </div>

      <button className="mt-3 flex w-full items-center justify-between rounded-[10px] border border-[var(--color-border)] px-2.5 py-2 text-[12px] font-medium text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg)]">
        Документ
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
    </Link>
  );
}
