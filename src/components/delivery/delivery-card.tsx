"use client";

import { Delivery, DELIVERY_DIRECTION_LABELS, DELIVERY_KIND_LABELS } from "@/lib/types";
import { cn, formatMoney } from "@/lib/utils";
import { ArrowRight, Camera, CheckCircle2, Package, Phone, Truck, User } from "lucide-react";
import Link from "next/link";

/** «4 д. 3 ч. 55 мин.» — как в референсе, без секунд */
export function formatLateness(ms: number) {
  const totalMinutes = Math.floor(Math.abs(ms) / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days >= 7) {
    const weeks = Math.floor(days / 7);
    const restDays = days % 7;
    return [`${weeks} нед.`, restDays ? `${restDays} д.` : "", `${hours} ч.`, `${minutes} мин.`].filter(Boolean).join(" ");
  }
  return [days ? `${days} д.` : "", `${hours} ч.`, `${minutes} мин.`].filter(Boolean).join(" ");
}

function formatWhen(iso?: string) {
  if (!iso) return "срок не задан";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "срок не задан";
  return d.toLocaleString("ru-RU", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function DeliveryCard({
  delivery,
  now,
  canEdit,
  onOpen,
  onAdvance,
}: {
  delivery: Delivery;
  /** Время приходит сверху, чтобы отсчёт просрочки тикал на всех карточках разом */
  now: Date;
  canEdit: boolean;
  onOpen: () => void;
  onAdvance: (status: Delivery["status"]) => void;
}) {
  const deadline = delivery.deliverBy ? new Date(delivery.deliverBy).getTime() : null;
  const unfinished = delivery.status === "new" || delivery.status === "in_progress";
  const lateMs = deadline && unfinished ? now.getTime() - deadline : 0;
  const overdue = lateMs > 0;
  const soon = !overdue && deadline && unfinished && deadline - now.getTime() < 2 * 3600000;

  return (
    <div className="flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] card-shadow">
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-semibold text-[var(--color-text-muted)]">№{delivery.number}</span>
            <span className="flex items-center gap-1 rounded-[6px] bg-[var(--color-bg)] px-1.5 py-0.5 text-[12px] text-[var(--color-text-muted)]">
              <Package className="h-3 w-3" />
              {delivery.items.length}
            </span>
          </div>
          <div className="mt-1 text-[13px] text-[var(--color-text-muted)]">Доставить до:</div>
          <div className="text-[15px] font-bold">{formatWhen(delivery.deliverBy)}</div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {overdue ? (
            <span className="flex items-center gap-1.5 rounded-full bg-[#FDECEC] px-2.5 py-1 text-[12px] font-semibold text-[#C0272D]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#C0272D]" /> Просрочено
            </span>
          ) : soon ? (
            <span className="rounded-full bg-[#FFF4E5] px-2.5 py-1 text-[12px] font-semibold text-[#B8620A]">Скоро срок</span>
          ) : delivery.status === "done" ? (
            <span className="flex items-center gap-1.5 rounded-full bg-[#EAF7EE] px-2.5 py-1 text-[12px] font-semibold text-[#1C8A46]">
              <CheckCircle2 className="h-3 w-3" /> Выполнено
            </span>
          ) : null}

          {canEdit && delivery.status === "new" && (
            <button
              onClick={() => onAdvance("in_progress")}
              className="flex items-center gap-1.5 rounded-[8px] border border-[var(--color-border)] px-2.5 py-1.5 text-[13px] font-semibold transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary-ink)]"
            >
              <Truck className="h-3.5 w-3.5" /> Доставить
            </button>
          )}
          {canEdit && delivery.status === "in_progress" && (
            <button
              onClick={() => onAdvance("done")}
              className="flex items-center gap-1.5 rounded-[8px] bg-[#1C8A46] px-2.5 py-1.5 text-[13px] font-semibold text-white transition hover:bg-[#167A3C]"
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Завершить
            </button>
          )}

          <button
            onClick={onOpen}
            className="rounded-[8px] bg-[var(--color-primary)] px-3 py-1.5 text-[13px] font-semibold text-[var(--color-on-primary)] transition hover:bg-[var(--color-primary-hover)]"
          >
            Запрос
          </button>
        </div>
      </div>

      <div className="border-t border-[var(--color-border)] px-4 py-2">
        <span className="border-l-[3px] border-[var(--color-primary)] pl-2 text-[13px] font-semibold uppercase italic tracking-wide text-[var(--color-text-muted)]">
          {DELIVERY_DIRECTION_LABELS[delivery.direction]} · {DELIVERY_KIND_LABELS[delivery.kind]}
        </span>
      </div>

      <div className="border-t border-[var(--color-border)] px-4 py-3">
        {overdue && (
          <div className="mb-1.5 text-[14px] font-semibold text-[#C0272D]">Уже просрочено на {formatLateness(lateMs)}</div>
        )}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px]">
          <span className="text-[var(--color-text-muted)]">Откуда:</span>
          <span className="font-semibold">{delivery.addressFrom || "—"}</span>
          <ArrowRight className="h-3 w-3 text-[var(--color-text-muted)]" />
          <span className="text-[var(--color-text-muted)]">Куда:</span>
          <span className="font-semibold">{delivery.addressTo || "—"}</span>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[var(--color-text-muted)]">
          {delivery.courierName && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" /> {delivery.courierName}
            </span>
          )}
          {delivery.receiverPhone && (
            <span className="flex items-center gap-1">
              <Phone className="h-3 w-3" /> {delivery.receiverPhone}
            </span>
          )}
          {delivery.price > 0 && <span className="font-semibold text-[var(--color-text)]">{formatMoney(delivery.price)}</span>}
          {delivery.rentalId && (
            <Link href={`/rentals/${delivery.rentalId}`} className="text-[var(--color-primary-ink)] underline-offset-2 hover:underline">
              Аренда №{delivery.rentalNumber}
            </Link>
          )}
        </div>
      </div>

      {delivery.items.length > 0 && (
        <div className="border-t border-[var(--color-border)] px-4 py-3">
          {delivery.items.map((item, i) => (
            <div key={`${item.sku}_${i}`} className={cn("flex items-center gap-2.5", i > 0 && "mt-2")}>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] bg-[var(--color-bg)] text-[var(--color-text-muted)]">
                <Camera className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0">
                <div className="truncate text-[14px] font-semibold">
                  {item.name}
                  {item.qty > 1 && <span className="ml-1 text-[var(--color-text-muted)]">×{item.qty}</span>}
                </div>
                <div className="text-[12.5px] text-[var(--color-text-muted)]">Артикул: {item.sku || "—"}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
