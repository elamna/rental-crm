"use client";

import { useAppStore } from "@/lib/store";
import { formatMoney } from "@/lib/utils";
import { PackageCheck, Boxes, AlertTriangle, CalendarClock, Wallet, TrendingUp, Bell, Sparkles } from "lucide-react";
import { RentalCard } from "@/components/rentals/rental-card";
import Link from "next/link";
import { useMemo } from "react";

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "только что";
  if (min < 60) return `${min} мин назад`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs} ч назад`;
  return `${Math.floor(hrs / 24)} дн назад`;
}

export default function DashboardPage() {
  const rentals = useAppStore((s) => s.rentals);
  const activity = useAppStore((s) => s.activity);
  const clients = useAppStore((s) => s.clients);

  const today = new Date().toISOString().slice(0, 10);

  const stats = useMemo(() => {
    const active = rentals.filter((r) => r.status === "active").length;
    const overdue = rentals.filter((r) => r.status === "overdue");
    const revenueToday = rentals
      .filter((r) => r.startDate.startsWith(today))
      .reduce((s, r) => s + r.paid, 0);
    const revenueMonth = rentals.reduce((s, r) => s + r.paid, 0);
    return {
      active,
      overdueList: overdue,
      overdueCount: overdue.length,
      expectedReturns: rentals.filter((r) => r.status === "active").length,
      revenueToday,
      revenueMonth,
    };
  }, [rentals, today]);

  const cards = [
    { label: "Активные аренды", value: stats.active, icon: PackageCheck, tint: "#6D4AFF" },
    { label: "Клиентов в базе", value: clients.length, icon: Boxes, tint: "#22C55E" },
    { label: "Просроченные аренды", value: stats.overdueCount, icon: AlertTriangle, tint: "#EF4444" },
    { label: "Ожидаемые возвраты", value: stats.expectedReturns, icon: CalendarClock, tint: "#F59E0B" },
    { label: "Выручка за сегодня", value: formatMoney(stats.revenueToday), icon: Wallet, tint: "#2E5FE0" },
    { label: "Выручка всего", value: formatMoney(stats.revenueMonth), icon: TrendingUp, tint: "#B8620A" },
  ];

  return (
    <div className="p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="font-display text-[22px] font-bold">Главная</h1>
          <p className="text-[13px] text-[var(--color-text-muted)]">Сводка по прокату на данный момент</p>
        </div>
        <Link
          href="/rentals/new"
          className="rounded-[10px] bg-[var(--color-primary)] px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_4px_14px_-4px_rgba(109,74,255,0.7)] transition hover:bg-[var(--color-primary-hover)]"
        >
          + Новая аренда
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        {cards.map((c) => (
          <div key={c.label} className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-4 card-shadow card-shadow-hover transition">
            <div className="mb-3 grid h-9 w-9 place-items-center rounded-[10px]" style={{ background: `${c.tint}18`, color: c.tint }}>
              <c.icon className="h-4.5 w-4.5" />
            </div>
            <div className="font-display text-[20px] font-bold">{c.value}</div>
            <div className="text-[12px] text-[var(--color-text-muted)]">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-[15px] font-bold">Просроченные аренды</h2>
            <Link href="/rentals" className="text-[12.5px] font-medium text-[var(--color-primary)]">
              Смотреть все →
            </Link>
          </div>
          {stats.overdueList.length === 0 ? (
            <div className="grid h-40 place-items-center rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)] bg-white text-[13px] text-[var(--color-text-muted)]">
              {rentals.length === 0 ? (
                <div className="text-center">
                  <p>Аренд пока нет.</p>
                  <Link href="/rentals/new" className="mt-1 inline-block font-medium text-[var(--color-primary)]">
                    Создать первую аренду →
                  </Link>
                </div>
              ) : (
                "Просроченных аренд нет"
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {stats.overdueList.map((r) => (
                <RentalCard key={r.id} rental={r} />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-5">
          <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-4 card-shadow">
            <div className="mb-3 flex items-center gap-2">
              <Bell className="h-4 w-4 text-[var(--color-primary)]" />
              <h2 className="text-[14px] font-semibold">Уведомления</h2>
            </div>
            {stats.overdueCount === 0 && stats.expectedReturns === 0 ? (
              <p className="text-[12.5px] text-[var(--color-text-muted)]">Новых уведомлений нет</p>
            ) : (
              <div className="space-y-2 text-[13px]">
                {stats.overdueCount > 0 && (
                  <div className="rounded-[10px] bg-[#FDECEC] px-3 py-2 text-[#C0272D]">
                    {stats.overdueCount} аренд просрочено — требуется связь с клиентом
                  </div>
                )}
                {stats.expectedReturns > 0 && (
                  <div className="rounded-[10px] bg-[#FEF6E3] px-3 py-2 text-[#B8860B]">
                    {stats.expectedReturns} аренд в процессе — ожидаются возвраты
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-4 card-shadow">
            <h2 className="mb-3 text-[14px] font-semibold">Последние действия</h2>
            {activity.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-4 text-center">
                <Sparkles className="h-5 w-5 text-[var(--color-text-muted)]" />
                <p className="text-[12.5px] text-[var(--color-text-muted)]">
                  Здесь появятся действия сотрудников — добавление клиентов, оформление аренд, оплаты
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {activity.slice(0, 8).map((a) => (
                  <div key={a.id} className="flex items-start gap-2.5 text-[12.5px]">
                    <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-primary)]" />
                    <div>
                      <div>{a.text}</div>
                      <div className="text-[11px] text-[var(--color-text-muted)]">{timeAgo(a.time)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
