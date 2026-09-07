"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { Delivery, DeliveryStatus } from "@/lib/types";
import { cn, formatMoney } from "@/lib/utils";
import { BarChart3, Plus, Search } from "lucide-react";
import { DeliveryCard } from "@/components/delivery/delivery-card";
import { DeliveryModal } from "@/components/delivery/delivery-modal";

const TABS: { key: DeliveryStatus; label: string }[] = [
  { key: "new", label: "Новые запросы" },
  { key: "in_progress", label: "В процессе" },
  { key: "done", label: "Завершено" },
  { key: "cancelled", label: "Отменённые" },
];

interface Stats {
  total: number;
  done: number;
  inProgress: number;
  overdue: number;
  revenue: number;
  avgHours: number | null;
  byCourier: { courier: string; total: number; done: number; revenue: number }[];
}

export default function DeliveryPage() {
  const { can } = useAuth();
  const canEdit = can("delivery.edit");

  const [tab, setTab] = useState<DeliveryStatus>("new");
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [counts, setCounts] = useState<Record<DeliveryStatus, number>>({ new: 0, in_progress: 0, done: 0, cancelled: 0 });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState<Delivery | null>(null);
  const [creating, setCreating] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);

  // Просрочка на карточках должна тикать сама — считаем от общего «сейчас»
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ status: tab });
    if (search.trim()) params.set("q", search.trim());
    const res = await fetch(`/api/deliveries?${params}`);
    if (res.ok) {
      const data = await res.json();
      setDeliveries(data.deliveries);
      setCounts(data.counts);
    }
    setLoading(false);
  }, [tab, search]);

  // Поиск не дёргает сервер на каждую букву
  useEffect(() => {
    const id = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(id);
  }, [load, search]);

  useEffect(() => {
    if (!showStats) return;
    fetch("/api/deliveries/stats?period=month")
      .then((r) => (r.ok ? r.json() : null))
      .then(setStats)
      .catch(() => setStats(null));
  }, [showStats]);

  /** Смена стадии: двигаем сразу, при ошибке откатываем */
  async function advance(delivery: Delivery, status: DeliveryStatus) {
    const prev = deliveries;
    setDeliveries((list) => list.filter((d) => d.id !== delivery.id));
    const res = await fetch(`/api/deliveries/${delivery.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      setDeliveries(prev);
      alert("Не удалось изменить статус доставки");
      return;
    }
    load();
  }

  if (!can("delivery.view")) {
    return (
      <div className="grid h-full place-items-center p-6 text-center text-[14.5px] text-[var(--color-text-muted)]">
        Нет доступа к разделу «Доставка»
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]/70 px-4 py-3 backdrop-blur sm:px-6 sm:py-4">
        <div className="min-w-0">
          <h1 className="font-display text-[20px] font-bold">Доставка</h1>
          <p className="text-[14px] text-[var(--color-text-muted)]">
            {counts.new + counts.in_progress} в работе, {counts.done} завершено
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowStats((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 whitespace-nowrap rounded-[10px] border px-3.5 py-2 text-[14px] font-semibold transition",
              showStats
                ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
                : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)]"
            )}
          >
            <BarChart3 className="h-3.5 w-3.5" /> Аналитика
          </button>
          {canEdit && (
            <button
              onClick={() => setCreating(true)}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-[10px] bg-[var(--color-primary)] px-4 py-2 text-[14px] font-semibold text-[var(--color-on-primary)] shadow-[var(--shadow-primary)] transition hover:bg-[var(--color-primary-hover)]"
            >
              <Plus className="h-3.5 w-3.5" /> Новая доставка
            </button>
          )}
        </div>
      </header>

      <div className="border-b border-[var(--color-border)] bg-[var(--color-surface)]/70 px-4 sm:px-6">
        <nav className="-mx-1 flex items-center gap-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setTab(t.key);
                setLoading(true);
              }}
              className={cn(
                "relative flex shrink-0 items-center gap-2 whitespace-nowrap px-3.5 pb-3 pt-2.5 text-[14.5px] font-semibold transition",
                tab === t.key ? "text-[var(--color-primary)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              )}
            >
              {t.label}
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[12px]",
                  tab === t.key ? "bg-[var(--color-primary-soft)] text-[var(--color-primary)]" : "bg-[var(--color-bg)]"
                )}
              >
                {counts[t.key]}
              </span>
              {tab === t.key && <span className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-[var(--color-primary)]" />}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
        {showStats && (
          <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 card-shadow">
            <h2 className="mb-3 font-display text-[16px] font-bold">Аналитика за 30 дней</h2>
            {!stats ? (
              <p className="text-[14px] text-[var(--color-text-muted)]">Считаем…</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
                  <Metric label="Всего" value={String(stats.total)} />
                  <Metric label="Выполнено" value={String(stats.done)} />
                  <Metric label="В пути" value={String(stats.inProgress)} />
                  <Metric label="Просрочено" value={String(stats.overdue)} tone={stats.overdue > 0 ? "bad" : undefined} />
                  <Metric label="Заработано" value={formatMoney(stats.revenue)} />
                  <Metric label="Среднее время" value={stats.avgHours === null ? "—" : `${stats.avgHours} ч`} />
                </div>
                {stats.byCourier.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {stats.byCourier.map((c) => (
                      <div key={c.courier} className="flex items-center justify-between rounded-[8px] bg-[var(--color-bg)] px-3 py-2 text-[13.5px]">
                        <span className="font-medium">{c.courier}</span>
                        <span className="text-[var(--color-text-muted)]">
                          {c.done} из {c.total} · {formatMoney(c.revenue)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <div className="relative w-full sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по адресу, клиенту или номеру"
            className="w-full rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] py-2.5 pl-9 pr-3 text-[14.5px] outline-none transition focus:border-[var(--color-primary)]"
          />
        </div>

        {loading ? (
          <p className="py-10 text-center text-[14px] text-[var(--color-text-muted)]">Загрузка…</p>
        ) : deliveries.length === 0 ? (
          <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] py-16 text-center card-shadow">
            <p className="text-[14.5px] text-[var(--color-text-muted)]">
              {tab === "new" ? "Новых запросов нет. Доставка создаётся из карточки аренды или кнопкой выше." : "Пусто"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {deliveries.map((d) => (
              <DeliveryCard
                key={d.id}
                delivery={d}
                now={now}
                canEdit={canEdit}
                onOpen={() => setEditing(d)}
                onAdvance={(status) => advance(d, status)}
              />
            ))}
          </div>
        )}
      </div>

      {creating && <DeliveryModal onClose={() => setCreating(false)} onSaved={load} />}
      {editing && <DeliveryModal delivery={editing} onClose={() => setEditing(null)} onSaved={load} />}
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "bad" }) {
  return (
    <div className="rounded-[10px] bg-[var(--color-bg)] px-3 py-2">
      <div className="text-[12px] text-[var(--color-text-muted)]">{label}</div>
      <div className={cn("font-display text-[17px] font-bold", tone === "bad" && "text-[#C0272D]")}>{value}</div>
    </div>
  );
}
