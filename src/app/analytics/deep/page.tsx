"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Users, Package, Clock, ShieldCheck } from "lucide-react";
import { formatMoney, plural } from "@/lib/utils";
import { PeriodPicker } from "@/components/ui/period-picker";
import { periodQuery, PERIOD_LABELS, type PeriodValue } from "@/lib/period";
import { useAuth } from "@/components/auth/auth-provider";

/**
 * Подробный отчёт: клиенты и инструмент.
 *
 * Страница отвечает на вопросы владельца, а не менеджера: кто возвращается,
 * кто пропал, что кормит, что простаивает и что чаще ломается. Поэтому она
 * закрыта от всех, кроме администратора, и лежит отдельно от обычной
 * аналитики — чтобы не утяжелять рабочий экран.
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
  };
}

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

export default function DeepAnalyticsPage() {
  // «Всё время» по умолчанию: отчёт про долгие закономерности, а не про сегодня
  const [period, setPeriod] = useState<PeriodValue>({ key: "all" });
  const [data, setData] = useState<DeepData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clientView, setClientView] = useState<ClientView>("revenue");
  const [toolView, setToolView] = useState<ToolView>("profit");
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading || !user?.isAdmin) return;
    setLoading(true);
    fetch(`/api/analytics/deep?${periodQuery(period)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { error?: string }).error || "Не удалось загрузить отчёт");
        return r.json();
      })
      .then((d) => { setData(d); setError(null); })
      .catch((e) => setError(e instanceof Error ? e.message : "Не удалось загрузить отчёт"))
      .finally(() => setLoading(false));
  }, [period, user, authLoading]);

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

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]/70 px-4 py-3 backdrop-blur sm:px-6 sm:py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <Link
              href="/analytics"
              className="mb-1 inline-flex items-center gap-1.5 text-[13px] text-[var(--color-text-muted)] hover:text-[var(--color-primary-ink)]"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Аналитика
            </Link>
            <h1 className="font-display text-[20px] font-bold">Подробный отчёт</h1>
            <p className="text-[14px] text-[var(--color-text-muted)]">Клиенты и инструмент за {periodLabel}</p>
          </div>
          <PeriodPicker value={period} onChange={setPeriod} />
        </div>
      </header>

      <div className="flex-1 space-y-6 overflow-y-auto p-4 sm:p-6">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
          </div>
        ) : error ? (
          <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center text-[14px] text-[#C0272D]">
            {error}
          </div>
        ) : !data ? null : (
          <>
            <ClientsBlock data={data} view={clientView} onView={setClientView} periodLabel={periodLabel} />
            <ToolsBlock data={data} view={toolView} onView={setToolView} periodLabel={periodLabel} />
          </>
        )}
      </div>
    </div>
  );
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
  const { totals, rows } = data.tools;
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
