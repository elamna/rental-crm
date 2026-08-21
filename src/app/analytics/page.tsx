"use client";

import { useEffect, useState } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, Users, Package, ClipboardList, AlertCircle, Wrench, CreditCard, ArrowUpRight } from "lucide-react";
import { formatMoney } from "@/lib/utils";

type Period = "week" | "month" | "year" | "all";

interface AnalyticsData {
  period: string;
  summary: {
    totalRevenue: number; totalRentals: number; activeRentals: number;
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

const STATUS_LABELS: Record<string, string> = {
  request: "Запрос", booked: "Забронировано", active: "В аренде",
  completed: "Завершено", overdue: "Просрочено", stolen: "Украдено", cancelled: "Отменено",
};
const STATUS_COLORS: Record<string, string> = {
  request: "#94A3B8", booked: "#6D4AFF", active: "#10B981",
  completed: "#3B82F6", overdue: "#EF4444", stolen: "#1F0A0A", cancelled: "#94A3B8",
};

const PERIOD_LABELS: Record<Period, string> = {
  week: "7 дней", month: "30 дней", year: "12 месяцев", all: "Всё время",
};

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>("month");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/analytics?period=${period}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); });
  }, [period]);

  const chartData = period === "year"
    ? data?.revenueByMonth.map((d) => ({ label: formatMonth(d.month), revenue: d.revenue, count: d.count }))
    : data?.revenueByDay.map((d) => ({ label: formatDay(d.day), revenue: d.revenue, count: d.count }));

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-[var(--color-border)] bg-white/70 px-6 py-4 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-[20px] font-bold">Аналитика</h1>
            <p className="text-[13px] text-[var(--color-text-muted)]">Ключевые показатели бизнеса</p>
          </div>
          {/* Переключатель периода */}
          <div className="flex items-center gap-1 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-bg)] p-1">
            {(["week", "month", "year", "all"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`rounded-[8px] px-3 py-1.5 text-[12.5px] font-medium transition ${period === p ? "bg-white text-[var(--color-primary)] shadow-sm" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"}`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
          </div>
        ) : !data ? null : (
          <>
            {/* KPI карточки */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <KpiCard icon={TrendingUp} label="Выручка" value={formatMoney(data.summary.totalRevenue)} color="primary" sub={`${data.summary.totalRentals} аренд за период`} />
              <KpiCard icon={CreditCard} label="Долги клиентов" value={formatMoney(data.summary.totalDebt)} color="danger" sub={`${data.summary.overdueRentals} просрочено`} />
              <KpiCard icon={ClipboardList} label="Активные аренды" value={String(data.summary.activeRentals)} color="success" sub={`${data.summary.overdueRentals} просрочено`} />
              <KpiCard icon={Users} label="Клиентов" value={String(data.summary.totalClients)} color="info" sub={`+${data.summary.newClients} за период`} />
              <KpiCard icon={Package} label="Инвентарь" value={`${data.summary.freeInventory} / ${data.summary.totalInventory}`} color="neutral" sub="свободно / всего" />
              <KpiCard icon={Wrench} label="Заявки мастерской" value={String(data.summary.workshopActive)} color="warning" sub="активных заявок" />
            </div>

            {/* График выручки */}
            <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-5 card-shadow">
              <h2 className="mb-4 text-[15px] font-semibold">Выручка за период</h2>
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
              <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-5 card-shadow">
                <h2 className="mb-4 text-[15px] font-semibold">Аренды по статусам</h2>
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
                        <div key={s.status} className="flex items-center gap-2 text-[12.5px]">
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
              <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-5 card-shadow">
                <h2 className="mb-4 text-[15px] font-semibold">Количество аренд</h2>
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
              <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-5 card-shadow">
                <h2 className="mb-4 text-[15px] font-semibold">Топ клиентов</h2>
                {data.topClients.length > 0 ? (
                  <div className="space-y-2">
                    {data.topClients.map((c, i) => (
                      <div key={c.id} className="flex items-center gap-3">
                        <span className="w-5 shrink-0 text-center text-[12px] font-bold text-[var(--color-text-muted)]">{i + 1}</span>
                        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--color-primary-soft)] text-[10px] font-bold text-[var(--color-primary)]">
                          {c.name.split(" ").slice(0, 2).map((n) => n[0]).join("")}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px] font-medium">{c.name}</div>
                          <div className="text-[11px] text-[var(--color-text-muted)]">{c.rentals_count} аренд</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[13px] font-semibold">{formatMoney(c.total_paid)}</div>
                          {c.total_debt > 0 && <div className="text-[11px] text-[#C0272D]">долг {formatMoney(c.total_debt)}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <EmptyList text="Нет данных по клиентам" />}
              </div>

              {/* Топ инвентаря */}
              <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-5 card-shadow">
                <h2 className="mb-4 text-[15px] font-semibold">Популярный инвентарь</h2>
                {data.topInventory.length > 0 ? (
                  <div className="space-y-2">
                    {data.topInventory.map((item, i) => (
                      <div key={item.name} className="flex items-center gap-3">
                        <span className="w-5 shrink-0 text-center text-[12px] font-bold text-[var(--color-text-muted)]">{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px] font-medium">{item.name}</div>
                          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
                            <div
                              className="h-full rounded-full bg-[var(--color-primary)]"
                              style={{ width: `${Math.min(100, (item.count / (data.topInventory[0]?.count || 1)) * 100)}%` }}
                            />
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[13px] font-semibold">{item.count}×</div>
                          <div className="text-[11px] text-[var(--color-text-muted)]">{formatMoney(item.revenue)}</div>
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
    <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-4 card-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[12px] font-medium text-[var(--color-text-muted)]">{label}</p>
          <p className="mt-1 text-[22px] font-bold leading-tight">{value}</p>
          <p className="mt-1 text-[11.5px] text-[var(--color-text-muted)]">{sub}</p>
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
      <p className="text-[13px] text-[var(--color-text-muted)]">Недостаточно данных для отображения</p>
    </div>
  );
}

function EmptyList({ text }: { text: string }) {
  return <p className="py-4 text-center text-[13px] text-[var(--color-text-muted)]">{text}</p>;
}

function formatDay(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function formatMonth(ym: string) {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1).toLocaleDateString("ru-RU", { month: "short", year: "2-digit" });
}
