"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Users, Package, Clock, ShieldCheck, Wrench } from "lucide-react";
import { formatMoney, plural } from "@/lib/utils";
import { PeriodPicker } from "@/components/ui/period-picker";
import { periodQuery, PERIOD_LABELS, type PeriodValue } from "@/lib/period";
import { useAuth } from "@/components/auth/auth-provider";
import { ClientTypeFilterToggle } from "@/components/ui/client-type-filter";
import type { ClientTypeFilter } from "@/lib/client-type";
import type {
  DeepSection,
  DeliveryData,
  FunnelData,
  OverviewData,
  RentalsData,
  RisksData,
  ServicesData,
  ShopData,
  TeamData,
} from "@/lib/deep-report";
import {
  DeliverySection,
  FunnelSection,
  OverviewSection,
  RentalsSection,
  RisksSection,
  ServicesSection,
  ShopSection,
  TeamSection,
} from "@/components/deep-report/sections";
import { Card, Table } from "@/components/deep-report/ui";

/**
 * Подробный отчёт: всё, что есть в системе, по разделам.
 *
 * Страница отвечает на вопросы владельца, а не менеджера: сколько заработали и
 * на чём, кто возвращается и кто пропал, что кормит, что простаивает и что чаще
 * ломается, как работает воронка, доставка, магазин и каждый сотрудник, где
 * висят долги. Поэтому она закрыта от всех, кроме администратора, и лежит
 * отдельно от обычной аналитики — чтобы не утяжелять рабочий экран.
 *
 * Разделы — вкладками: одиннадцать блоков на одной странице превращались бы в
 * простыню. Каждая вкладка запрашивает только свой раздел.
 */

interface ClientRow {
  id: string;
  name: string;
  type: string;
  phone: string;
  blacklisted: boolean;
  channel: string | null;
  rentals: number;
  revenue: number;
  debt: number;
  days: number;
  avgDays: number;
  avgCheck: number;
  late: number;
  returned: number;
  overdue: number;
  lifetimeRentals: number;
  lastAt: string | null;
  sinceDays: number | null;
}

interface ToolRow {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  status: string;
  purchaseCost: number | null;
  rentals: number;
  days: number;
  revenue: number;
  repairCost: number;
  profit: number;
  tickets: number;
  repairs: number;
  lastRepairAt: string | null;
  utilization: number;
  avgDays: number;
  rentalsPerRepair: number | null;
  workshopDays: number;
  idleCost: number;
  repairShare: number | null;
}

interface DeepData {
  clients: {
    totals: {
      all: number; individuals: number; companies: number; blacklisted: number;
      newInPeriod: number; activeInPeriod: number; everRented: number; neverRented: number;
      repeat: number; repeatShare: number; sleeping: number;
    };
    punctuality: { onTime: number; late: number; share: number | null; avgLateHours: number };
    channels: { channel: string; clients: number; rentals: number; revenue: number }[];
    rows: ClientRow[];
  };
  tools: {
    totals: {
      items: number; rented: number; neverRented: number; inRepair: number;
      revenue: number; repairCost: number; profit: number; days: number; unlinkedRevenue: number;
    };
    rows: ToolRow[];
    categories?: { label: string; items: number; rented: number; revenue: number; repairCost: number; days: number }[];
  };
  workshop: {
    totals: { tickets: number; open: number; cost: number; avgTicket: number; days: number; idleCost: number };
    byReason: Record<string, { count: number; cost: number; days: number }>;
    longest: { id: string; number: string; title: string; item: string; days: number; cost: number; open: boolean }[];
    rows: ToolRow[];
  };
}

const REASON_LABELS: Record<string, string> = {
  service: "Плановое ТО",
  maintenance: "Диагностика после возврата",
  repair: "Ремонт",
};

type ClientView = "revenue" | "often" | "debt" | "late" | "sleeping";
type ToolView = "profit" | "often" | "idle" | "breaks" | "durable";

const CLIENT_VIEWS: { key: ClientView; label: string }[] = [
  { key: "revenue", label: "Приносят больше всех" },
  { key: "often", label: "Берут чаще всех" },
  { key: "debt", label: "Должники" },
  { key: "late", label: "Возвращают с опозданием" },
  { key: "sleeping", label: "Пропали" },
];

const TOOL_VIEWS: { key: ToolView; label: string }[] = [
  { key: "profit", label: "Зарабатывают больше всех" },
  { key: "often", label: "Берут чаще всех" },
  { key: "idle", label: "Простаивают" },
  { key: "breaks", label: "Чаще всего ломаются" },
  { key: "durable", label: "Служат дольше всех" },
];

type TabKey = DeepSection | "clients" | "tools" | "workshop";

/** Вкладки в том порядке, в каком владелец о них думает: сначала деньги, потом люди и вещи */
const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Обзор" },
  { key: "rentals", label: "Аренды" },
  { key: "clients", label: "Клиенты" },
  { key: "tools", label: "Инструмент" },
  { key: "workshop", label: "Мастерская" },
  { key: "funnel", label: "Воронка" },
  { key: "delivery", label: "Доставка" },
  { key: "shop", label: "Магазин" },
  { key: "services", label: "Услуги и комплекты" },
  { key: "team", label: "Команда" },
  { key: "risks", label: "Риски и долги" },
];

/** Клиенты, инструмент и мастерская приходят одним ответом — они считаются вместе */
const PEOPLE_TABS: TabKey[] = ["clients", "tools", "workshop"];

export default function DeepAnalyticsPage() {
  // «Всё время» по умолчанию: отчёт про долгие закономерности, а не про сегодня
  const [period, setPeriod] = useState<PeriodValue>({ key: "all" });
  const [clientType, setClientType] = useState<ClientTypeFilter>("all");
  const [tab, setTab] = useState<TabKey>("overview");
  // Ответы складываются по ключу «вкладка + период + отбор»: вернулся на
  // вкладку — она открывается сразу, без повторного расчёта
  const [cache, setCache] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);
  const [clientView, setClientView] = useState<ClientView>("revenue");
  const [toolView, setToolView] = useState<ToolView>("profit");
  const { user, loading: authLoading } = useAuth();

  const isPeople = PEOPLE_TABS.includes(tab);
  const query = `${periodQuery(period)}${clientType !== "all" ? `&clientType=${clientType}` : ""}`;
  const cacheKey = `${isPeople ? "people" : tab}|${query}`;
  const current = cache[cacheKey];

  useEffect(() => {
    if (authLoading || !user?.isAdmin || current !== undefined) return;
    let cancelled = false;
    setError(null);
    fetch(`/api/analytics/deep?${query}${isPeople ? "" : `&section=${tab}`}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { error?: string }).error || "Не удалось загрузить отчёт");
        return r.json();
      })
      .then((d) => {
        if (!cancelled) setCache((c) => ({ ...c, [cacheKey]: isPeople ? d : d.data }));
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Не удалось загрузить отчёт");
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, user, current, query, tab, isPeople, cacheKey]);

  if (!authLoading && !user?.isAdmin) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="max-w-md rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center card-shadow">
          <ShieldCheck className="mx-auto h-8 w-8 text-[var(--color-text-muted)]" />
          <h1 className="mt-3 font-display text-[17px] font-bold">Отчёт только для администратора</h1>
          <p className="mt-1.5 text-[14px] text-[var(--color-text-muted)]">
            В нём поимённая оценка клиентов и себестоимость инструмента. Обычная аналитика открыта всем, у кого есть к ней доступ.
          </p>
          <Link href="/analytics" className="mt-4 inline-block rounded-[10px] bg-[var(--color-primary)] px-4 py-2 text-[14px] font-semibold text-white">
            Вернуться в аналитику
          </Link>
        </div>
      </div>
    );
  }

  const periodLabel = period.key === "custom" ? "выбранный период" : PERIOD_LABELS[period.key].toLowerCase();
  const typeLabel = clientType === "company" ? " · только юрлица" : clientType === "individual" ? " · только физлица" : "";

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]/70 px-4 pt-3 backdrop-blur sm:px-6 sm:pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <Link
              href="/analytics"
              className="mb-1 inline-flex items-center gap-1.5 text-[13px] text-[var(--color-text-muted)] hover:text-[var(--color-primary-ink)]"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Аналитика
            </Link>
            <h1 className="font-display text-[20px] font-bold">Подробный отчёт</h1>
            <p className="text-[14px] text-[var(--color-text-muted)]">
              Всё о прокате за {periodLabel}
              {typeLabel}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ClientTypeFilterToggle value={clientType} onChange={setClientType} />
            <PeriodPicker value={period} onChange={setPeriod} />
          </div>
        </div>

        {/* Разделы — вкладками, а не одной простынёй: так каждый читается отдельно */}
        <nav className="-mx-4 mt-3 flex gap-1 overflow-x-auto px-4 sm:-mx-6 sm:px-6" aria-label="Разделы отчёта">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={(e) => {
                setTab(t.key);
                // На телефоне вкладки уезжают вбок — выбранную подтягиваем в середину
                // ряда. Крутим только сам ряд: scrollIntoView сдвигал вбок всю
                // страницу, и левая половина экрана уезжала за край
                const nav = e.currentTarget.parentElement;
                if (nav) {
                  const btn = e.currentTarget.getBoundingClientRect();
                  const box = nav.getBoundingClientRect();
                  nav.scrollTo({ left: nav.scrollLeft + btn.left - box.left - (box.width - btn.width) / 2, behavior: "smooth" });
                }
              }}
              // Черта под вкладкой — тенью, а не рамкой: глобальный цвет рамок
              // в тёмной теме перекрашивал «прозрачную» рамку в серую у всех вкладок
              className={
                "shrink-0 whitespace-nowrap px-3 py-2.5 text-[13.5px] font-semibold transition " +
                (tab === t.key
                  ? "text-[var(--color-primary-ink)] shadow-[inset_0_-2px_0_var(--color-primary)]"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]")
              }
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <div className="flex-1 space-y-6 overflow-y-auto p-4 sm:p-6">
        {error ? (
          <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center text-[14px] text-[#C0272D]">
            {error}
          </div>
        ) : current === undefined ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
          </div>
        ) : (
          <TabContent
            tab={tab}
            data={current}
            periodLabel={periodLabel}
            clientView={clientView}
            onClientView={setClientView}
            toolView={toolView}
            onToolView={setToolView}
          />
        )}
      </div>
    </div>
  );
}

function TabContent({
  tab,
  data,
  periodLabel,
  clientView,
  onClientView,
  toolView,
  onToolView,
}: {
  tab: TabKey;
  data: unknown;
  periodLabel: string;
  clientView: ClientView;
  onClientView: (v: ClientView) => void;
  toolView: ToolView;
  onToolView: (v: ToolView) => void;
}) {
  switch (tab) {
    case "overview":
      return <OverviewSection data={data as OverviewData} periodLabel={periodLabel} />;
    case "rentals":
      return <RentalsSection data={data as RentalsData} />;
    case "funnel":
      return <FunnelSection data={data as FunnelData} />;
    case "delivery":
      return <DeliverySection data={data as DeliveryData} />;
    case "shop":
      return <ShopSection data={data as ShopData} />;
    case "services":
      return <ServicesSection data={data as ServicesData} />;
    case "team":
      return <TeamSection data={data as TeamData} />;
    case "risks":
      return <RisksSection data={data as RisksData} />;
    case "clients":
      return <ClientsBlock data={data as DeepData} view={clientView} onView={onClientView} periodLabel={periodLabel} />;
    case "tools":
      return <ToolsBlock data={data as DeepData} view={toolView} onView={onToolView} periodLabel={periodLabel} />;
    case "workshop":
      return (data as DeepData).workshop ? <WorkshopBlock data={data as DeepData} periodLabel={periodLabel} /> : null;
  }
}

// ─── Клиенты ─────────────────────────────────────────────────────────────────

function ClientsBlock({
  data, view, onView, periodLabel,
}: { data: DeepData; view: ClientView; onView: (v: ClientView) => void; periodLabel: string }) {
  const { totals, punctuality, channels, rows } = data.clients;
  const shown = sortClients(rows, view).slice(0, 25);

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="grid h-8 w-8 place-items-center rounded-[10px] bg-[#EEF2FF] text-[#4F46E5]">
          <Users className="h-4 w-4" />
        </div>
        <h2 className="font-display text-[18px] font-bold">Клиенты</h2>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          label="Всего клиентов"
          value={String(totals.all)}
          sub={`${totals.individuals} ${plural(totals.individuals, "частный", "частных", "частных")}, ${totals.companies} ${plural(
            totals.companies,
            "компания",
            "компании",
            "компаний"
          )}`}
        />
        <Tile label="Брали за период" value={String(totals.activeInPeriod)} sub={`+${totals.newInPeriod} новых`} tone="primary" />
        <Tile
          label="Возвращаются"
          value={totals.everRented > 0 ? `${totals.repeatShare}%` : "—"}
          sub={`${totals.repeat} из ${totals.everRented} брали больше одного раза`}
          tone="success"
        />
        <Tile
          label="Пропали"
          value={String(totals.sleeping)}
          sub="не брали больше 90 дней"
          tone={totals.sleeping > 0 ? "warning" : undefined}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 card-shadow">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-[var(--color-text-muted)]" />
            <h3 className="text-[15px] font-semibold">Возвращают вовремя</h3>
          </div>
          {punctuality.share === null ? (
            <p className="mt-3 text-[14px] text-[var(--color-text-muted)]">
              Пока не с чем сравнивать: возвраты за {periodLabel} не отмечались.
            </p>
          ) : (
            <>
              <div className="mt-2 font-display text-[28px] font-bold">{punctuality.share}%</div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--color-bg)]">
                <div className="h-full rounded-full bg-[#1C8A46]" style={{ width: `${Math.max(2, punctuality.share)}%` }} />
              </div>
              <p className="mt-2 text-[13px] text-[var(--color-text-muted)]">
                Вовремя {punctuality.onTime}, с опозданием {punctuality.late}
                {punctuality.late > 0 ? ` — в среднем на ${punctuality.avgLateHours} ч` : ""}
              </p>
            </>
          )}
        </div>

        <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 card-shadow lg:col-span-2">
          <h3 className="text-[15px] font-semibold">Откуда приходят</h3>
          {channels.length === 0 ? (
            <p className="mt-3 text-[14px] text-[var(--color-text-muted)]">Канал привлечения в карточках клиентов не заполнен.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {channels.slice(0, 6).map((c) => (
                <div key={c.channel} className="flex items-center gap-3">
                  <div className="w-28 shrink-0 truncate text-[13.5px]">{c.channel}</div>
                  {/* На телефоне полоска съедала место у суммы — там она не нужна */}
                  <div className="hidden h-2 flex-1 overflow-hidden rounded-full bg-[var(--color-bg)] sm:block">
                    <div
                      className="h-full rounded-full bg-[var(--color-primary)]"
                      style={{ width: `${Math.max(2, Math.round((c.revenue / (channels[0]?.revenue || 1)) * 100))}%` }}
                    />
                  </div>
                  <div className="ml-auto w-16 shrink-0 text-right text-[13px] text-[var(--color-text-muted)]">{c.clients} кл.</div>
                  <div className="w-28 shrink-0 text-right text-[13.5px] font-semibold">{formatMoney(c.revenue)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 card-shadow">
        <ViewTabs views={CLIENT_VIEWS} active={view} onChange={onView} title="Поимённо" />
        {shown.length === 0 ? (
          <p className="py-8 text-center text-[14px] text-[var(--color-text-muted)]">Нет клиентов под это условие</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-[14px]">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left text-[13px] text-[var(--color-text-muted)]">
                  <th className="pb-2 font-semibold">Клиент</th>
                  <th className="pb-2 text-right font-semibold">Аренд</th>
                  <th className="pb-2 text-right font-semibold">Дней</th>
                  <th className="pb-2 text-right font-semibold">Средняя аренда</th>
                  <th className="pb-2 text-right font-semibold">Выручка</th>
                  <th className="pb-2 text-right font-semibold">Долг</th>
                  <th className="pb-2 text-right font-semibold">Опозданий</th>
                  <th className="pb-2 text-right font-semibold">Последняя</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((c) => (
                  <tr key={c.id} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="py-2.5">
                      <Link href={`/clients/${c.id}`} className="font-medium text-[var(--color-primary-ink)] underline-offset-2 hover:underline">
                        {c.name}
                      </Link>
                      <div className="text-[12.5px] text-[var(--color-text-muted)]">
                        {c.phone}
                        {c.type === "company" ? " · компания" : ""}
                        {c.blacklisted ? " · в чёрном списке" : ""}
                      </div>
                    </td>
                    <td className="py-2.5 text-right">{c.rentals}</td>
                    <td className="py-2.5 text-right text-[var(--color-text-muted)]">{c.days}</td>
                    <td className="py-2.5 text-right text-[var(--color-text-muted)]">{c.avgDays ? `${c.avgDays} дн.` : "—"}</td>
                    <td className="py-2.5 text-right font-semibold">{formatMoney(c.revenue)}</td>
                    <td className={`py-2.5 text-right ${c.debt > 0 ? "font-semibold text-[#C0272D]" : "text-[var(--color-text-muted)]"}`}>
                      {c.debt > 0 ? formatMoney(c.debt) : "—"}
                    </td>
                    <td className={`py-2.5 text-right ${c.late > 0 ? "font-semibold text-[#B8620A]" : "text-[var(--color-text-muted)]"}`}>
                      {c.late > 0 ? `${c.late} из ${c.returned}` : "—"}
                    </td>
                    <td className="py-2.5 text-right text-[var(--color-text-muted)]">
                      {c.sinceDays === null ? "не брал" : c.sinceDays === 0 ? "сегодня" : `${c.sinceDays} дн. назад`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function sortClients(rows: ClientRow[], view: ClientView): ClientRow[] {
  const list = [...rows];
  if (view === "revenue") return list.filter((c) => c.rentals > 0).sort((a, b) => b.revenue - a.revenue);
  if (view === "often") return list.filter((c) => c.rentals > 0).sort((a, b) => b.rentals - a.rentals || b.revenue - a.revenue);
  if (view === "debt") return list.filter((c) => c.debt > 0).sort((a, b) => b.debt - a.debt);
  if (view === "late") return list.filter((c) => c.late > 0).sort((a, b) => b.late - a.late);
  // Пропавшие: когда-то брали, но давно — сначала самые ценные из потерянных
  return list
    .filter((c) => c.sinceDays !== null && c.sinceDays > 90)
    .sort((a, b) => b.lifetimeRentals - a.lifetimeRentals || (a.sinceDays ?? 0) - (b.sinceDays ?? 0));
}

// ─── Инструмент ──────────────────────────────────────────────────────────────

function ToolsBlock({
  data, view, onView, periodLabel,
}: { data: DeepData; view: ToolView; onView: (v: ToolView) => void; periodLabel: string }) {
  const { totals, rows, categories = [] } = data.tools;
  const shown = sortTools(rows, view).slice(0, 25);

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="grid h-8 w-8 place-items-center rounded-[10px] bg-[var(--color-primary-soft)] text-[var(--color-primary-ink)]">
          <Package className="h-4 w-4" />
        </div>
        <h2 className="font-display text-[18px] font-bold">Инструмент</h2>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Позиций на складе" value={String(totals.items)} sub={`сдавали ${totals.rented} за ${periodLabel}`} />
        <Tile
          label="Ни разу не сдавали"
          value={String(totals.neverRented)}
          sub="лежат мёртвым грузом"
          tone={totals.neverRented > 0 ? "warning" : undefined}
        />
        <Tile
          label="Заработали"
          value={formatMoney(totals.revenue)}
          sub={`${totals.days} ${plural(totals.days, "день", "дня", "дней")} в аренде`}
          tone="primary"
        />
        <Tile
          label="Чистыми"
          value={formatMoney(totals.profit)}
          sub={`минус ${formatMoney(totals.repairCost)} на мастерскую`}
          tone={totals.profit >= 0 ? "success" : "danger"}
        />
      </div>

      {totals.unlinkedRevenue > 0 && (
        <p className="rounded-[10px] bg-[var(--color-bg)] px-3 py-2 text-[13px] text-[var(--color-text-muted)]">
          Ещё {formatMoney(totals.unlinkedRevenue)} пришли с позиций, не привязанных к складу, — товары магазина и строки,
          вписанные в заявку руками. Их не с чем сопоставить по ремонтам, поэтому в таблице ниже их нет.
        </p>
      )}

      {categories.length > 0 && (
        <Card title="По категориям каталога" hint="Какие направления проката зарабатывают, а какие стоят">
          <Table
            minWidth={560}
            head={[
              { label: "Категория" },
              { label: "Позиций", align: "right" },
              { label: "Сдавались", align: "right" },
              { label: "Дней в работе", align: "right" },
              { label: "Выручка", align: "right" },
              { label: "Ремонт", align: "right" },
            ]}
            rows={categories.map((c) => ({
              key: c.label,
              cells: [c.label, c.items, `${c.rented} из ${c.items}`, c.days, formatMoney(c.revenue), c.repairCost ? formatMoney(c.repairCost) : "—"],
            }))}
          />
        </Card>
      )}

      <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 card-shadow">
        <ViewTabs views={TOOL_VIEWS} active={view} onChange={onView} title="По позициям" />
        {shown.length === 0 ? (
          <p className="py-8 text-center text-[14px] text-[var(--color-text-muted)]">
            {view === "breaks" ? "За этот период инструмент в ремонт не попадал" : "Нет позиций под это условие"}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-[14px]">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left text-[13px] text-[var(--color-text-muted)]">
                  <th className="pb-2 font-semibold">Инструмент</th>
                  <th className="pb-2 text-right font-semibold">Сдач</th>
                  <th className="pb-2 text-right font-semibold">Дней в работе</th>
                  <th className="pb-2 text-right font-semibold">Загрузка</th>
                  <th className="pb-2 text-right font-semibold">Выручка</th>
                  <th className="pb-2 text-right font-semibold">Ремонтов</th>
                  <th className="pb-2 text-right font-semibold">Потратили</th>
                  <th className="pb-2 text-right font-semibold">Чистыми</th>
                  <th className="pb-2 text-right font-semibold">Ресурс</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((t) => (
                  <tr key={t.id} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="py-2.5">
                      <Link href={`/catalog/${t.id}`} className="font-medium text-[var(--color-primary-ink)] underline-offset-2 hover:underline">
                        {t.name}
                      </Link>
                      <div className="text-[12.5px] text-[var(--color-text-muted)]">
                        {t.sku || t.category || "без артикула"}
                        {t.purchaseCost ? ` · куплен за ${formatMoney(t.purchaseCost)}` : ""}
                      </div>
                    </td>
                    <td className="py-2.5 text-right">{t.rentals}</td>
                    <td className="py-2.5 text-right text-[var(--color-text-muted)]">{t.days}</td>
                    <td className="py-2.5 text-right">
                      <span className={t.utilization < 10 ? "text-[#B8620A]" : ""}>{t.utilization}%</span>
                    </td>
                    <td className="py-2.5 text-right font-semibold">{formatMoney(t.revenue)}</td>
                    <td className={`py-2.5 text-right ${t.repairs > 0 ? "font-semibold text-[#C0272D]" : "text-[var(--color-text-muted)]"}`}>
                      {t.tickets > 0 ? `${t.repairs} из ${t.tickets}` : "—"}
                    </td>
                    <td className="py-2.5 text-right text-[var(--color-text-muted)]">
                      {t.repairCost > 0 ? formatMoney(t.repairCost) : "—"}
                    </td>
                    <td className={`py-2.5 text-right font-semibold ${t.profit < 0 ? "text-[#C0272D]" : ""}`}>{formatMoney(t.profit)}</td>
                    <td className="py-2.5 text-right text-[var(--color-text-muted)]">
                      {resourceText(t)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * Ресурс позиции словами.
 *
 * Дробное «ломается каждые 2.5 сдач» читается плохо и по-русски неверно,
 * поэтому в таблице стоят целые числа, а дробь остаётся только сортировкой.
 */
function resourceText(t: ToolRow) {
  if (t.rentals === 0) return "—";
  if (t.repairs === 0) return `${t.rentals} ${plural(t.rentals, "сдача", "сдачи", "сдач")} без поломок`;
  return `${t.repairs} ${plural(t.repairs, "ремонт", "ремонта", "ремонтов")} на ${t.rentals} ${plural(t.rentals, "сдачу", "сдачи", "сдач")}`;
}

function sortTools(rows: ToolRow[], view: ToolView): ToolRow[] {
  const list = [...rows];
  if (view === "profit") return list.filter((t) => t.rentals > 0 || t.repairCost > 0).sort((a, b) => b.profit - a.profit);
  if (view === "often") return list.filter((t) => t.rentals > 0).sort((a, b) => b.rentals - a.rentals || b.days - a.days);
  // Простаивают: сначала те, кого вообще не брали, дальше по загрузке
  if (view === "idle") return list.sort((a, b) => a.utilization - b.utilization || a.rentals - b.rentals);
  if (view === "breaks") {
    return list.filter((t) => t.repairs > 0).sort((a, b) => b.repairs - a.repairs || b.repairCost - a.repairCost);
  }
  // Служат дольше всех: работают много и не ломаются. Инструмент без поломок
  // идёт впереди любого чинёного, между собой — по числу выдач
  return list
    .filter((t) => t.rentals > 0)
    .sort((a, b) => {
      const aRes = a.rentalsPerRepair ?? Number.POSITIVE_INFINITY;
      const bRes = b.rentalsPerRepair ?? Number.POSITIVE_INFINITY;
      if (aRes !== bRes) return bRes - aRes;
      return b.rentals - a.rentals;
    });
}

// ─── Мастерская ──────────────────────────────────────────────────────────────

/**
 * Мастерская глазами владельца.
 *
 * На странице аналитики видно, сколько мастерская стоила. Здесь второй счёт,
 * который обычно не ведут: простой. Пока инструмент чинится, он не сдаётся, и
 * дни в ремонте по дневной ставке — это деньги, которых прокат не увидел.
 * Оценка сверху: в эти дни инструмент мог и не найти клиента.
 */
function WorkshopBlock({ data, periodLabel }: { data: DeepData; periodLabel: string }) {
  const { totals, byReason, longest, rows } = data.workshop;
  const reasons = Object.entries(byReason).filter(([, v]) => v.count > 0);

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="grid h-8 w-8 place-items-center rounded-[10px] bg-[#FEF6E3] text-[#B8860B]">
          <Wrench className="h-4 w-4" />
        </div>
        <h2 className="font-display text-[18px] font-bold">Мастерская</h2>
      </div>

      {totals.tickets === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-center text-[14px] text-[var(--color-text-muted)] card-shadow">
          За {periodLabel} мастерская не работала — заявок нет.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile
              label="Заявок"
              value={String(totals.tickets)}
              sub={totals.open > 0 ? `${totals.open} ещё не закрыты` : "все закрыты"}
            />
            <Tile label="Потратили" value={formatMoney(totals.cost)} sub={`в среднем ${formatMoney(totals.avgTicket)} на заявку`} tone="danger" />
            <Tile
              label="Простой"
              value={`${totals.days} ${plural(totals.days, "день", "дня", "дней")}`}
              sub="инструмент был в мастерской, а не в работе"
              tone="warning"
            />
            <Tile label="Простой стоил" value={formatMoney(totals.idleCost)} sub="по дневной ставке, оценка сверху" />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 card-shadow">
              <h3 className="mb-3 text-[15px] font-semibold">Куда уходит время и деньги</h3>
              <div className="space-y-2">
                {reasons.map(([key, value]) => (
                  // Подпись тянется, цифры стоят на своих местах: при фиксированной
                  // ширине подписи сумма упиралась в край карточки и обрезалась
                  <div key={key} className="flex items-center gap-2 text-[13.5px]">
                    <span className="min-w-0 flex-1 truncate text-[var(--color-text-muted)]">{REASON_LABELS[key] ?? key}</span>
                    <span className="w-14 shrink-0 text-right text-[var(--color-text-muted)]">{value.count} шт.</span>
                    <span className="w-16 shrink-0 text-right text-[var(--color-text-muted)]">
                      {value.days} {plural(value.days, "день", "дня", "дней")}
                    </span>
                    <span className="w-24 shrink-0 text-right font-semibold">{formatMoney(value.cost)}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[12.5px] text-[var(--color-text-muted)]">
                Дни — средний срок от заявки до закрытия. Открытые заявки считаются по сегодняшний день.
              </p>
            </div>

            <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 card-shadow">
              <h3 className="mb-3 text-[15px] font-semibold">Самые долгие ремонты</h3>
              <div className="space-y-2">
                {longest.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 text-[13.5px]">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{t.item}</div>
                      <div className="truncate text-[12px] text-[var(--color-text-muted)]">
                        {t.number} · {t.title}
                        {t.open ? " · ещё в работе" : ""}
                      </div>
                    </div>
                    <span className={`shrink-0 font-semibold ${t.open ? "text-[#B8620A]" : ""}`}>
                      {t.days} {plural(t.days, "день", "дня", "дней")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 card-shadow">
            <h3 className="mb-4 text-[15px] font-semibold">Что чиним и почём</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-[14px]">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-left text-[13px] text-[var(--color-text-muted)]">
                    <th className="pb-2 font-semibold">Инструмент</th>
                    <th className="pb-2 text-right font-semibold">Заявок</th>
                    <th className="pb-2 text-right font-semibold">Ремонтов</th>
                    <th className="pb-2 text-right font-semibold">Потратили</th>
                    <th className="pb-2 text-right font-semibold">От цены покупки</th>
                    <th className="pb-2 text-right font-semibold">Простой</th>
                    <th className="pb-2 text-right font-semibold">Простой стоил</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 25).map((t) => (
                    <tr key={t.id} className="border-b border-[var(--color-border)] last:border-0">
                      <td className="py-2.5">
                        <Link href={`/catalog/${t.id}`} className="font-medium text-[var(--color-primary-ink)] underline-offset-2 hover:underline">
                          {t.name}
                        </Link>
                        <div className="text-[12.5px] text-[var(--color-text-muted)]">
                          {t.purchaseCost ? `куплен за ${formatMoney(t.purchaseCost)}` : t.sku || "без артикула"}
                        </div>
                      </td>
                      <td className="py-2.5 text-right">{t.tickets}</td>
                      <td className={`py-2.5 text-right ${t.repairs > 0 ? "font-semibold text-[#C0272D]" : "text-[var(--color-text-muted)]"}`}>
                        {t.repairs || "—"}
                      </td>
                      <td className="py-2.5 text-right font-semibold">{formatMoney(t.repairCost)}</td>
                      <td className="py-2.5 text-right">
                        {t.repairShare === null ? (
                          <span className="text-[var(--color-text-muted)]">цена не указана</span>
                        ) : (
                          // Ремонт съел половину стоимости — инструмент пора менять,
                          // а не чинить: об этом и говорит красная цифра
                          <span className={t.repairShare >= 50 ? "font-semibold text-[#C0272D]" : "text-[var(--color-text-muted)]"}>
                            {t.repairShare}%
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 text-right text-[var(--color-text-muted)]">
                        {t.workshopDays} {plural(t.workshopDays, "день", "дня", "дней")}
                      </td>
                      <td className="py-2.5 text-right text-[var(--color-text-muted)]">{formatMoney(t.idleCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

// ─── Общие мелочи ────────────────────────────────────────────────────────────

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  const tones: Record<string, string> = {
    primary: "bg-[var(--color-primary-soft)] text-[var(--color-primary-ink)]",
    success: "bg-[#EAF7EE] text-[#1C8A46]",
    warning: "bg-[#FEF6E3] text-[#B8860B]",
    danger: "bg-[#FDECEC] text-[#C0272D]",
  };
  const skin = tone ? tones[tone] : "";
  return (
    <div className={`rounded-[12px] border border-[var(--color-border)] px-4 py-3 ${skin || "bg-[var(--color-surface)]"}`}>
      <div className={`text-[12.5px] ${skin ? "font-medium" : "text-[var(--color-text-muted)]"}`}>{label}</div>
      <div className="mt-0.5 font-display text-[21px] font-bold">{value}</div>
      {sub && <div className={`mt-0.5 text-[12.5px] ${skin ? "opacity-80" : "text-[var(--color-text-muted)]"}`}>{sub}</div>}
    </div>
  );
}

function ViewTabs<T extends string>({
  views, active, onChange, title,
}: { views: { key: T; label: string }[]; active: T; onChange: (v: T) => void; title: string }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h3 className="text-[15px] font-semibold">{title}</h3>
      <div className="flex flex-wrap items-center gap-1 rounded-[10px] bg-[var(--color-bg)] p-1">
        {views.map((v) => (
          <button
            key={v.key}
            onClick={() => onChange(v.key)}
            className={`rounded-[8px] px-3 py-1.5 text-[13.5px] font-semibold transition ${
              active === v.key ? "bg-[var(--color-surface)] text-[var(--color-primary-ink)] shadow-sm" : "text-[var(--color-text-muted)]"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>
    </div>
  );
}
