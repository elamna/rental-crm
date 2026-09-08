"use client";

import { useEffect, useState } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, Users, Package, ClipboardList, AlertCircle, Wrench, CreditCard, ArrowUpRight } from "lucide-react";
import { formatMoney } from "@/lib/utils";
import { PeriodPicker } from "@/components/ui/period-picker";
import { periodQuery, PERIOD_LABELS, type Granularity, type PeriodValue } from "@/lib/period";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/types";
import Link from "next/link";

interface AnalyticsData {
  period: string;
  granularity: Granularity;
  summary: {
    totalRevenue: number; totalRentals: number; activeRentals: number; bookedRentals: number;
    overdueRentals: number; totalDebt: number; newClients: number;
    totalClients: number; freeInventory: number; totalInventory: number;
    workshopActive: number;
  };
  revenueByDay: { day: string; revenue: number; count: number }[];
  revenueByMonth: { month: string; revenue: number; count: number }[];
  topClients: { id: string; name: string; phone: string; rentals_count: number; total_paid: number; total_debt: number }[];
  topInventory: { name: string; count: number; revenue: number }[];
  byStatus: { status: string; count: number }[];
}

/** Поступления за период в двух разрезах: чем платили и за что */
interface IncomeData {
  methods: { cash: number; kaspi: number; company: number };
  /** Оплаты, принятые до того, как начали записывать способ */
  untracked: number;
  sources: { rent: number; shop: number; delivery: number };
  total: number;
  paidTotal: number;
}

/** Поимённо: кто за период заплатил и кто остался должен */
interface LedgerData {
  paid: {
    id: string; amount: number; method: PaymentMethod; createdAt: string; createdBy?: string;
    rentalId: string; rentalNumber: string; rentalTotal: number; rentalPaid: number;
    clientId?: string; clientName?: string; clientPhone?: string;
  }[];
  unpaid: {
    rentalId: string; rentalNumber: string; status: string; total: number; paid: number; debt: number;
    createdAt: string; endAt: string;
    clientId?: string; clientName?: string; clientPhone?: string;
  }[];
  totals: { paidTotal: number; debtTotal: number; payers: number; debtors: number };
}

const STATUS_LABELS: Record<string, string> = {
  request: "Запрос", booked: "Забронировано", active: "В аренде",
  completed: "Завершено", overdue: "Просрочено", stolen: "Украдено", cancelled: "Отменено",
};
const STATUS_COLORS: Record<string, string> = {
  request: "#A8A599", booked: "#2B5FD9", active: "#0E7C66",
  completed: "#3B82F6", overdue: "#EF4444", stolen: "#1F0A0A", cancelled: "#94A3B8",
};

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<PeriodValue>({ key: "month" });
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [income, setIncome] = useState<IncomeData | null>(null);
  const [incomeView, setIncomeView] = useState<"all" | "methods" | "sources">("all");
  const [ledger, setLedger] = useState<LedgerData | null>(null);
  const [ledgerView, setLedgerView] = useState<"paid" | "unpaid">("paid");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/analytics?${periodQuery(period)}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); });

    fetch(`/api/analytics/income?${periodQuery(period)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setIncome)
      .catch(() => setIncome(null));

    fetch(`/api/analytics/payers?${periodQuery(period)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setLedger)
      .catch(() => setLedger(null));
  }, [period]);

  const periodLabel = period.key === "custom" ? "выбранный период" : PERIOD_LABELS[period.key].toLowerCase();

  // Шаг графика задаёт сервер: сутки — по часам, длинный период — по месяцам
  const chartData = data?.revenueByDay.map((d) => ({
    label: formatBucket(d.day, data.granularity),
    revenue: d.revenue,
    count: d.count,
  }));

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]/70 px-4 py-3 backdrop-blur sm:px-6 sm:py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-[20px] font-bold">Аналитика</h1>
            <p className="text-[14px] text-[var(--color-text-muted)]">Ключевые показатели бизнеса</p>
          </div>
          <PeriodPicker value={period} onChange={setPeriod} />
        </div>
      </header>

      <div className="flex-1 space-y-6 overflow-y-auto p-4 sm:p-6">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
          </div>
        ) : !data ? null : (
          <>
            {income && (
              <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 card-shadow">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-[17px] font-bold">Поступления за период</h2>
                    <p className="text-[13.5px] text-[var(--color-text-muted)]">
                      Всего {formatMoney(income.total)} · аренды {formatMoney(income.paidTotal)}, доставка {formatMoney(income.sources.delivery)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 rounded-[10px] bg-[var(--color-bg)] p-1">
                    {(
                      [
                        { key: "all", label: "Все" },
                        { key: "methods", label: "Чем платили" },
                        { key: "sources", label: "За что" },
                      ] as { key: "all" | "methods" | "sources"; label: string }[]
                    ).map((o) => (
                      <button
                        key={o.key}
                        onClick={() => setIncomeView(o.key)}
                        className={`rounded-[8px] px-3 py-1.5 text-[13.5px] font-semibold transition ${
                          incomeView === o.key
                            ? "bg-[var(--color-surface)] text-[var(--color-primary)] shadow-sm"
                            : "text-[var(--color-text-muted)]"
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                  {incomeView !== "sources" && (
                    <>
                      <IncomeTile label="Kaspi" value={income.methods.kaspi} total={income.total} tone="#37A0E4" />
                      <IncomeTile label="Наличные" value={income.methods.cash} total={income.total} tone="#1C8A46" />
                      <IncomeTile label="От компаний" value={income.methods.company} total={income.total} tone="#2B5FD9" />
                    </>
                  )}
                  {incomeView !== "methods" && (
                    <>
                      <IncomeTile label="Аренда инструмента" value={income.sources.rent} total={income.total} tone="#0E7C66" />
                      <IncomeTile label="Магазин" value={income.sources.shop} total={income.total} tone="#B8620A" />
                      <IncomeTile label="Доставка" value={income.sources.delivery} total={income.total} tone="#7C3AED" />
                    </>
                  )}
                </div>

                {incomeView !== "sources" && income.untracked > 0 && (
                  <p className="mt-3 rounded-[10px] bg-[var(--color-bg)] px-3 py-2 text-[13px] text-[var(--color-text-muted)]">
                    Ещё {formatMoney(income.untracked)} приняты до того, как начали записывать способ оплаты — они есть в общей
                    сумме, но не разложены по Kaspi и наличным.
                  </p>
                )}

                <p className="mt-3 text-[13px] text-[var(--color-text-muted)]">
                  «Чем платили» и «за что» — два разреза одних и тех же денег, складывать их между собой не нужно.
                </p>
              </section>
            )}

            {ledger && <PayersSection ledger={ledger} view={ledgerView} onView={setLedgerView} periodLabel={periodLabel} />}

            {/* KPI карточки */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <KpiCard icon={TrendingUp} label="Выручка" value={formatMoney(data.summary.totalRevenue)} color="primary" sub={`${data.summary.totalRentals} аренд за период`} />
              <KpiCard icon={CreditCard} label="Долги клиентов" value={formatMoney(data.summary.totalDebt)} color="danger" sub={`${data.summary.bookedRentals} забронировано, ${data.summary.overdueRentals} просрочено`} />
              <KpiCard icon={ClipboardList} label="Активные аренды" value={String(data.summary.activeRentals)} color="success" sub={`${data.summary.overdueRentals} просрочено`} />
              <KpiCard icon={Users} label="Клиентов" value={String(data.summary.totalClients)} color="info" sub={`+${data.summary.newClients} за период`} />
              <KpiCard icon={Package} label="Инвентарь" value={`${data.summary.freeInventory} / ${data.summary.totalInventory}`} color="neutral" sub="свободно / всего" />
              <KpiCard icon={Wrench} label="Заявки мастерской" value={String(data.summary.workshopActive)} color="warning" sub="активных заявок" />
            </div>

            {/* График выручки */}
            <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 card-shadow">
              <h2 className="mb-4 text-[16px] font-semibold">Выручка за период</h2>
              {chartData && chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v) => [formatMoney(Number(v ?? 0)), "Выручка"]} labelStyle={{ fontSize: 12 }} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--color-border)" }} />
                    <Bar dataKey="revenue" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart />
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Аренды по статусам */}
              <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 card-shadow">
                <h2 className="mb-4 text-[16px] font-semibold">Аренды по статусам</h2>
                {data.byStatus.length > 0 ? (
                  <div className="flex items-center gap-6">
                    <ResponsiveContainer width={160} height={160}>
                      <PieChart>
                        <Pie data={data.byStatus} dataKey="count" nameKey="status" cx="50%" cy="50%" innerRadius={45} outerRadius={75}>
                          {data.byStatus.map((entry) => (
                            <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? "#94A3B8"} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v, name) => [v, STATUS_LABELS[name as string] ?? name]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-1.5">
                      {data.byStatus.map((s) => (
                        <div key={s.status} className="flex items-center gap-2 text-[13.5px]">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: STATUS_COLORS[s.status] ?? "#94A3B8" }} />
                          <span className="text-[var(--color-text-muted)]">{STATUS_LABELS[s.status] ?? s.status}</span>
                          <span className="ml-auto font-semibold">{s.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : <EmptyChart />}
              </div>

              {/* Количество аренд по дням */}
              <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 card-shadow">
                <h2 className="mb-4 text-[16px] font-semibold">Количество аренд</h2>
                {chartData && chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} />
                      <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip formatter={(v) => [Number(v ?? 0), "Аренд"]} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--color-border)" }} />
                      <Line type="monotone" dataKey="count" stroke="var(--color-primary)" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : <EmptyChart />}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Топ клиентов */}
              <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 card-shadow">
                <h2 className="mb-4 text-[16px] font-semibold">Топ клиентов</h2>
                {data.topClients.length > 0 ? (
                  <div className="space-y-2">
                    {data.topClients.map((c, i) => (
                      <div key={c.id} className="flex items-center gap-3">
                        <span className="w-5 shrink-0 text-center text-[13px] font-bold text-[var(--color-text-muted)]">{i + 1}</span>
                        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--color-primary-soft)] text-[11px] font-bold text-[var(--color-primary)]">
                          {c.name.split(" ").slice(0, 2).map((n) => n[0]).join("")}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[14px] font-medium">{c.name}</div>
                          <div className="text-[12px] text-[var(--color-text-muted)]">{c.rentals_count} аренд</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[14px] font-semibold">{formatMoney(c.total_paid)}</div>
                          {c.total_debt > 0 && <div className="text-[12px] text-[#C0272D]">долг {formatMoney(c.total_debt)}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <EmptyList text="Нет данных по клиентам" />}
              </div>

              {/* Топ инвентаря */}
              <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 card-shadow">
                <h2 className="mb-4 text-[16px] font-semibold">Популярный инвентарь</h2>
                {data.topInventory.length > 0 ? (
                  <div className="space-y-2">
                    {data.topInventory.map((item, i) => (
                      <div key={item.name} className="flex items-center gap-3">
                        <span className="w-5 shrink-0 text-center text-[13px] font-bold text-[var(--color-text-muted)]">{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[14px] font-medium">{item.name}</div>
                          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
                            <div
                              className="h-full rounded-full bg-[var(--color-primary)]"
                              style={{ width: `${Math.min(100, (item.count / (data.topInventory[0]?.count || 1)) * 100)}%` }}
                            />
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[14px] font-semibold">{item.count}×</div>
                          <div className="text-[12px] text-[var(--color-text-muted)]">{formatMoney(item.revenue)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <EmptyList text="Нет данных по инвентарю" />}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Вспомогательные компоненты ──────────────────────────────────────────────

/** Сумма с долей в общем потоке: доля показывает вес источника, а не просто цифру */
function IncomeTile({ label, value, total, tone }: { label: string; value: number; total: number; tone: string }) {
  const share = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="rounded-[12px] border border-[var(--color-border)] px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: tone }} />
        <span className="text-[13.5px] text-[var(--color-text-muted)]">{label}</span>
      </div>
      <div className="mt-1 font-display text-[20px] font-bold">{formatMoney(value)}</div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--color-bg)]">
        <div className="h-full rounded-full" style={{ width: `${Math.max(2, share)}%`, background: tone }} />
      </div>
      <div className="mt-1 text-[12.5px] text-[var(--color-text-muted)]">{share}% от поступлений</div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, color, sub }: {
  icon: React.ElementType; label: string; value: string; color: string; sub: string;
}) {
  const colorMap: Record<string, string> = {
    primary: "bg-[var(--color-primary-soft)] text-[var(--color-primary)]",
    danger: "bg-[#FDECEC] text-[#C0272D]",
    success: "bg-[#EAF7EE] text-[#1C8A46]",
    info: "bg-[#EEF2FF] text-[#4F46E5]",
    neutral: "bg-[#F1F2F6] text-[#8A8F9C]",
    warning: "bg-[#FEF6E3] text-[#B8860B]",
  };
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 card-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[13px] font-medium text-[var(--color-text-muted)]">{label}</p>
          <p className="mt-1 text-[22px] font-bold leading-tight">{value}</p>
          <p className="mt-1 text-[12.5px] text-[var(--color-text-muted)]">{sub}</p>
        </div>
        <div className={`grid h-9 w-9 place-items-center rounded-[10px] ${colorMap[color] ?? colorMap.neutral}`}>
          <Icon className="h-4.5 w-4.5" />
        </div>
      </div>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-32 items-center justify-center rounded-[10px] bg-[var(--color-bg)]">
      <p className="text-[14px] text-[var(--color-text-muted)]">Недостаточно данных для отображения</p>
    </div>
  );
}

function EmptyList({ text }: { text: string }) {
  return <p className="py-4 text-center text-[14px] text-[var(--color-text-muted)]">{text}</p>;
}

function formatBucket(value: string, granularity: Granularity) {
  if (granularity === "hour") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? value : d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  }
  if (granularity === "month") return formatMonth(value);
  const d = new Date(value + "T00:00:00");
  return isNaN(d.getTime()) ? value : d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function formatMonth(ym: string) {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1).toLocaleDateString("ru-RU", { month: "short", year: "2-digit" });
}

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Кто заплатил и кто нет.
 *
 * Из сводных сумм не видно, кому звонить: за «долги 240 000 ₸» стоят конкретные
 * люди с телефонами. Списки идут за тот же период, что и вся страница, — на
 * «24 часах» это ровно сегодняшняя касса и сегодняшние неплательщики.
 */
function PayersSection({
  ledger,
  view,
  onView,
  periodLabel,
}: {
  ledger: LedgerData;
  view: "paid" | "unpaid";
  onView: (v: "paid" | "unpaid") => void;
  periodLabel: string;
}) {
  const rows = view === "paid" ? ledger.paid : ledger.unpaid;

  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 card-shadow">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-[17px] font-bold">Кто заплатил, а кто нет</h2>
          <p className="text-[13.5px] text-[var(--color-text-muted)]">
            За {periodLabel}: заплатили {ledger.totals.payers} кл. — {formatMoney(ledger.totals.paidTotal)} · должны{" "}
            {ledger.totals.debtors} кл. — {formatMoney(ledger.totals.debtTotal)}
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-[10px] bg-[var(--color-bg)] p-1">
          {(
            [
              { key: "paid", label: "Оплатили", count: ledger.paid.length },
              { key: "unpaid", label: "Не оплатили", count: ledger.unpaid.length },
            ] as { key: "paid" | "unpaid"; label: string; count: number }[]
          ).map((o) => (
            <button
              key={o.key}
              onClick={() => onView(o.key)}
              className={`flex items-center gap-2 rounded-[8px] px-3 py-1.5 text-[13.5px] font-semibold transition ${
                view === o.key ? "bg-[var(--color-surface)] text-[var(--color-primary)] shadow-sm" : "text-[var(--color-text-muted)]"
              }`}
            >
              {o.label}
              <span className="rounded-full bg-[var(--color-surface)] px-1.5 py-0.5 text-[12px]">{o.count}</span>
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="py-8 text-center text-[14px] text-[var(--color-text-muted)]">
          {view === "paid" ? "За этот период оплат не было" : "Долгов за этот период нет"}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-[14px]">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-[13px] text-[var(--color-text-muted)]">
                <th className="pb-2 font-semibold">Клиент</th>
                <th className="pb-2 font-semibold">Аренда</th>
                <th className="pb-2 font-semibold">{view === "paid" ? "Способ" : "Срок"}</th>
                <th className="pb-2 font-semibold">{view === "paid" ? "Когда и кто принял" : "Оплачено"}</th>
                <th className="pb-2 text-right font-semibold">{view === "paid" ? "Сумма" : "Долг"}</th>
              </tr>
            </thead>
            <tbody>
              {view === "paid"
                ? ledger.paid.map((p) => (
                    <tr key={p.id} className="border-b border-[var(--color-border)] last:border-0">
                      <td className="py-2.5">
                        {p.clientId ? (
                          <Link href={`/clients/${p.clientId}`} className="font-medium text-[var(--color-primary)] underline-offset-2 hover:underline">
                            {p.clientName ?? "Клиент"}
                          </Link>
                        ) : (
                          <span className="font-medium">{p.clientName ?? "—"}</span>
                        )}
                        <div className="text-[12.5px] text-[var(--color-text-muted)]">{p.clientPhone ?? "—"}</div>
                      </td>
                      <td className="py-2.5">
                        <Link href={`/rentals/${p.rentalId}`} className="text-[var(--color-primary)] underline-offset-2 hover:underline">
                          №{p.rentalNumber}
                        </Link>
                      </td>
                      <td className="py-2.5">{PAYMENT_METHOD_LABELS[p.method] ?? p.method}</td>
                      <td className="py-2.5 text-[var(--color-text-muted)]">
                        {formatWhen(p.createdAt)}
                        {p.createdBy ? ` · ${p.createdBy}` : ""}
                      </td>
                      <td className="py-2.5 text-right font-semibold text-[#1C8A46]">{formatMoney(p.amount)}</td>
                    </tr>
                  ))
                : ledger.unpaid.map((d) => (
                    <tr key={d.rentalId} className="border-b border-[var(--color-border)] last:border-0">
                      <td className="py-2.5">
                        {d.clientId ? (
                          <Link href={`/clients/${d.clientId}`} className="font-medium text-[var(--color-primary)] underline-offset-2 hover:underline">
                            {d.clientName ?? "Клиент"}
                          </Link>
                        ) : (
                          <span className="font-medium">{d.clientName ?? "—"}</span>
                        )}
                        <div className="text-[12.5px] text-[var(--color-text-muted)]">{d.clientPhone ?? "—"}</div>
                      </td>
                      <td className="py-2.5">
                        <Link href={`/rentals/${d.rentalId}`} className="text-[var(--color-primary)] underline-offset-2 hover:underline">
                          №{d.rentalNumber}
                        </Link>
                        <div className="text-[12.5px] text-[var(--color-text-muted)]">{STATUS_LABELS[d.status] ?? d.status}</div>
                      </td>
                      <td className="py-2.5 text-[var(--color-text-muted)]">до {formatWhen(d.endAt)}</td>
                      <td className="py-2.5 text-[var(--color-text-muted)]">
                        {formatMoney(d.paid)} из {formatMoney(d.total)}
                      </td>
                      <td className="py-2.5 text-right font-bold text-[#C0272D]">{formatMoney(d.debt)}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
