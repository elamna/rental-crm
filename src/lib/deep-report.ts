import { db } from "./db";
import { clientIdOfType, clientTypeSql, rentalIdOfType, type ClientTypeFilter } from "./client-type";
import type { InventoryLine } from "./types";

/**
 * Подробный отчёт владельца — всё, что есть в системе, по разделам.
 *
 * Клиенты, инструмент и мастерская считаются в самом маршруте отчёта (они
 * появились первыми и считаются одним проходом). Здесь — остальные разделы:
 * обзор, аренды, воронка, доставка, магазин, услуги и комплекты, команда,
 * риски и долги. Каждый раздел — отдельная функция: страница запрашивает
 * только открытую вкладку, а не весь отчёт разом.
 *
 * Отбор «физлица / юрлица» проходит через все разделы, где есть клиент.
 * Склад магазина и каталог к клиентам не относятся — они не делятся.
 */

export type DeepSection =
  | "overview"
  | "rentals"
  | "funnel"
  | "delivery"
  | "shop"
  | "services"
  | "team"
  | "risks";

export const LIB_SECTIONS: DeepSection[] = ["overview", "rentals", "funnel", "delivery", "shop", "services", "team", "risks"];

interface Ctx {
  from: string;
  to: string;
  type: ClientTypeFilter;
  now: number;
}

const DAY = 86400000;
const num = (value: unknown) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const round = (value: number) => Math.round(value);
const round1 = (value: number) => Math.round(value * 10) / 10;
const share = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

function parseJson<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

const parseLines = (json: string | null) => {
  const value = parseJson<unknown>(json, []);
  return Array.isArray(value) ? (value as InventoryLine[]) : [];
};

/** Последние двенадцать месяцев ключами YYYY-MM — ось для всех графиков по месяцам */
function lastMonths(count = 12): string[] {
  const out: string[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = count - 1; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

/** Строки «название → значение», отсортированные и обрезанные — основа всех рейтингов отчёта */
function ranked<T extends { value: number }>(rows: T[], limit = 8): T[] {
  return rows.sort((a, b) => b.value - a.value).slice(0, limit);
}

/** Дни аренды: до факта возврата или до «сейчас», но не в будущее */
function rentalDays(startAt: string, endAt: string, returnedAt: string | null, now: number) {
  const start = Date.parse(startAt);
  const endSource = Date.parse(returnedAt ?? endAt);
  const end = Math.min(isNaN(endSource) ? now : endSource, now);
  if (isNaN(start) || start > now || end <= start) return 0;
  return Math.max(1, Math.round((end - start) / DAY));
}

interface RentalRow {
  id: string;
  number: string;
  status: string;
  client_id: string;
  start_at: string;
  end_at: string;
  returned_at: string | null;
  total: number;
  paid: number;
  items_json: string;
  created_at: string;
  rental_period: string | null;
  branch: string | null;
  delivery: number;
  booked_by_name: string | null;
  issued_by_name: string | null;
  penalties_json: string | null;
  expenses_json: string | null;
  deposit_json: string | null;
}

/** Аренды периода (по дате оформления) с отбором по типу клиента; отменённые не считаем */
function periodRentals(ctx: Ctx): RentalRow[] {
  return db
    .prepare(
      `SELECT id, number, status, client_id, start_at, end_at, returned_at, total, paid, items_json, created_at,
              rental_period, branch, delivery, booked_by_name, issued_by_name, penalties_json, expenses_json, deposit_json
       FROM rentals
       WHERE status NOT IN ('cancelled') AND created_at >= ? AND created_at <= ?${clientIdOfType("client_id", ctx.type)}`
    )
    .all(ctx.from, ctx.to) as RentalRow[];
}

/** Выручка аренды по месяцам за год — одна и та же ось для обзора и аренд */
function monthlyRentals(ctx: Ctx) {
  const months = lastMonths();
  const rows = db
    .prepare(
      `SELECT strftime('%Y-%m', created_at) AS month, COUNT(*) AS count, COALESCE(SUM(paid), 0) AS revenue
       FROM rentals
       WHERE status NOT IN ('cancelled') AND created_at >= ?${clientIdOfType("client_id", ctx.type)}
       GROUP BY month`
    )
    .all(`${months[0]}-01`) as { month: string; count: number; revenue: number }[];
  const byMonth = new Map(rows.map((r) => [r.month, r]));
  return months.map((month) => ({
    month,
    count: byMonth.get(month)?.count ?? 0,
    revenue: round(byMonth.get(month)?.revenue ?? 0),
  }));
}

/** Сколько из оплаченного пришлось на товары магазина — они продаются внутри аренды */
function shopShare(rental: RentalRow) {
  const lines = parseLines(rental.items_json);
  const weights = lines.map((l) => num(l.pricePerDay) * num(l.qty));
  const sum = weights.reduce((a, b) => a + b, 0);
  let shop = 0;
  lines.forEach((line, i) => {
    if (line.category === "shop" && sum > 0) shop += (num(rental.paid) * weights[i]) / sum;
  });
  return shop;
}

// ─── Обзор ──────────────────────────────────────────────────────────────────

function overview(ctx: Ctx) {
  const rentals = periodRentals(ctx);
  const revenue = rentals.reduce((s, r) => s + num(r.paid), 0);
  const shop = rentals.reduce((s, r) => s + shopShare(r), 0);

  const delivery = (
    db
      .prepare(
        `SELECT COALESCE(SUM(price), 0) AS v FROM deliveries
         WHERE status = 'done' AND COALESCE(completed_at, created_at) >= ? AND COALESCE(completed_at, created_at) <= ?${rentalIdOfType("rental_id", ctx.type)}`
      )
      .get(ctx.from, ctx.to) as { v: number }
  ).v;

  const workshop = (
    db
      .prepare(`SELECT lines_json FROM workshop_tickets WHERE created_at >= ? AND created_at <= ?${rentalIdOfType("source_rental_id", ctx.type)}`)
      .all(ctx.from, ctx.to) as { lines_json: string }[]
  ).reduce((s, t) => s + parseJson<{ qty: number; price: number }[]>(t.lines_json, []).reduce((a, l) => a + num(l.qty) * num(l.price), 0), 0);

  const leadType = clientTypeSql("client_type", ctx.type);
  const leads = db
    .prepare(`SELECT status FROM leads WHERE created_at >= ? AND created_at <= ?${leadType ? " AND " + leadType : ""}`)
    .all(ctx.from, ctx.to) as { status: string }[];
  const won = leads.filter((l) => l.status === "won").length;
  const lost = leads.filter((l) => l.status === "lost").length;

  const debtNow = (
    db
      .prepare(
        `SELECT COALESCE(SUM(total - paid), 0) AS v FROM rentals
         WHERE total > paid AND status NOT IN ('cancelled','request')${clientIdOfType("client_id", ctx.type)}`
      )
      .get() as { v: number }
  ).v;

  const activeClients = new Set(rentals.map((r) => r.client_id)).size;
  const typeOnly = clientTypeSql("type", ctx.type);
  const newClients = (
    db
      .prepare(`SELECT COUNT(*) AS v FROM clients WHERE created_at >= ? AND created_at <= ?${typeOnly ? " AND " + typeOnly : ""}`)
      .get(ctx.from, ctx.to) as { v: number }
  ).v;

  // Откуда деньги: аренда, магазин, доставка — это одна сумма, разложенная на части
  const income = [
    { label: "Аренда инструмента", value: round(revenue - shop) },
    { label: "Товары магазина", value: round(shop) },
    { label: "Доставка", value: round(delivery) },
  ];

  return {
    kpi: {
      income: round(revenue + delivery),
      rentals: rentals.length,
      avgCheck: rentals.length ? round(revenue / rentals.length) : 0,
      activeClients,
      newClients,
      leads: leads.length,
      conversion: won + lost > 0 ? share(won, won + lost) : null,
      workshopCost: round(workshop),
      debtNow: round(debtNow),
      net: round(revenue + delivery - workshop),
    },
    income,
    monthly: monthlyRentals(ctx),
  };
}

// ─── Аренды ─────────────────────────────────────────────────────────────────

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const PERIOD_LABELS: Record<string, string> = { hourly: "Почасовая", daily: "Посуточная", weekly: "Понедельная", monthly: "Помесячная" };
const STATUS_LABELS: Record<string, string> = {
  request: "Запрос",
  booked: "Бронь",
  active: "В аренде",
  overdue: "Просрочена",
  completed: "Завершена",
  stolen: "Украдено",
};
const DEPOSIT_LABELS: Record<string, string> = { money: "Деньгами", document: "Документом", equipment: "Техникой", other: "Другое" };

function rentalsSection(ctx: Ctx) {
  const rentals = periodRentals(ctx);
  const revenue = rentals.reduce((s, r) => s + num(r.paid), 0);

  const byStatus = new Map<string, number>();
  const byPeriod = new Map<string, number>();
  const byBranch = new Map<string, { count: number; revenue: number }>();
  const byWeekday = WEEKDAYS.map((label) => ({ label, value: 0 }));
  const byLength = [
    { label: "До суток", value: 0 },
    { label: "2–3 дня", value: 0 },
    { label: "4–7 дней", value: 0 },
    { label: "8–30 дней", value: 0 },
    { label: "Больше месяца", value: 0 },
  ];
  const deposits = new Map<string, { count: number; amount: number }>();
  let days = 0;
  let withDays = 0;
  let penalties = 0;
  let penaltyCount = 0;
  let expenses = 0;
  let withDelivery = 0;
  let late = 0;
  let returned = 0;

  for (const r of rentals) {
    byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1);
    const period = r.rental_period || "daily";
    byPeriod.set(period, (byPeriod.get(period) ?? 0) + 1);
    const branch = r.branch || "Не указан";
    const b = byBranch.get(branch) ?? { count: 0, revenue: 0 };
    b.count++;
    b.revenue += num(r.paid);
    byBranch.set(branch, b);

    const start = new Date(r.start_at);
    if (!isNaN(start.getTime())) byWeekday[(start.getDay() + 6) % 7].value++;

    const d = rentalDays(r.start_at, r.end_at, r.returned_at, ctx.now);
    if (d > 0) {
      days += d;
      withDays++;
      const bucket = d <= 1 ? 0 : d <= 3 ? 1 : d <= 7 ? 2 : d <= 30 ? 3 : 4;
      byLength[bucket].value++;
    }

    for (const p of parseJson<{ amount: number }[]>(r.penalties_json, [])) {
      penalties += num(p.amount);
      penaltyCount++;
    }
    for (const e of parseJson<{ amount: number }[]>(r.expenses_json, [])) expenses += num(e.amount);

    const deposit = parseJson<{ type?: string; amount?: number } | null>(r.deposit_json, null);
    if (deposit?.type) {
      const entry = deposits.get(deposit.type) ?? { count: 0, amount: 0 };
      entry.count++;
      entry.amount += num(deposit.amount);
      deposits.set(deposit.type, entry);
    }
    if (r.delivery) withDelivery++;
    if (r.returned_at) {
      returned++;
      if (Date.parse(r.returned_at) > Date.parse(r.end_at) + 3600000) late++;
    }
  }

  // Документы по арендам периода: сколько собрано и сколько отправлено клиенту ссылкой
  const docs = db
    .prepare(
      `SELECT COUNT(*) AS made, COALESCE(SUM(CASE WHEN shared_at IS NOT NULL THEN 1 ELSE 0 END), 0) AS shared,
              COALESCE(SUM(CASE WHEN signed = 1 THEN 1 ELSE 0 END), 0) AS signed
       FROM rental_documents WHERE created_at >= ? AND created_at <= ?${rentalIdOfType("rental_id", ctx.type)}`
    )
    .get(ctx.from, ctx.to) as { made: number; shared: number; signed: number };

  return {
    kpi: {
      count: rentals.length,
      revenue: round(revenue),
      avgCheck: rentals.length ? round(revenue / rentals.length) : 0,
      avgDays: withDays ? round1(days / withDays) : 0,
      lateShare: returned ? share(late, returned) : null,
      withDelivery: share(withDelivery, rentals.length),
      penalties: round(penalties),
      penaltyCount,
      expenses: round(expenses),
    },
    byStatus: [...byStatus.entries()].map(([key, value]) => ({ key, label: STATUS_LABELS[key] ?? key, value })),
    byPeriod: ranked([...byPeriod.entries()].map(([key, value]) => ({ label: PERIOD_LABELS[key] ?? key, value }))),
    byWeekday,
    byLength,
    byBranch: ranked([...byBranch.entries()].map(([label, v]) => ({ label, value: v.count, revenue: round(v.revenue) }))),
    deposits: [...deposits.entries()].map(([key, v]) => ({ label: DEPOSIT_LABELS[key] ?? key, value: v.count, amount: round(v.amount) })),
    documents: docs,
    monthly: monthlyRentals(ctx),
  };
}

// ─── Воронка ────────────────────────────────────────────────────────────────

const CONCERN_LABELS: Record<string, string> = { expensive: "Дорого", far: "Далеко", delivery: "Дорогая доставка" };

function funnel(ctx: Ctx) {
  const leadType = clientTypeSql("l.client_type", ctx.type);
  const leads = db
    .prepare(
      `SELECT l.title, l.status, l.source, l.amount, l.unavailable, l.other_city, l.future, l.concerns,
              l.created_at, l.closed_at, u.name AS manager
       FROM leads l LEFT JOIN app_users u ON u.id = l.manager_id
       WHERE l.created_at >= ? AND l.created_at <= ?${leadType ? " AND " + leadType : ""}`
    )
    .all(ctx.from, ctx.to) as {
    title: string;
    status: string;
    source: string | null;
    amount: number;
    unavailable: number;
    other_city: number;
    future: number;
    concerns: string | null;
    created_at: string;
    closed_at: string | null;
    manager: string | null;
  }[];

  type Group = { label: string; value: number; won: number; lost: number; amountWon: number };
  const group = (map: Map<string, Group>, key: string) => {
    let g = map.get(key);
    if (!g) {
      g = { label: key, value: 0, won: 0, lost: 0, amountWon: 0 };
      map.set(key, g);
    }
    return g;
  };
  const bySource = new Map<string, Group>();
  const byManager = new Map<string, Group>();
  const concerns = new Map<string, number>();
  const missing = new Map<string, number>();
  let won = 0;
  let lost = 0;
  let open = 0;
  let amountWon = 0;
  let amountLost = 0;
  let closeDays = 0;
  let closedWon = 0;

  for (const l of leads) {
    for (const g of [group(bySource, l.source || "Не указан"), group(byManager, l.manager || "Не назначен")]) {
      g.value++;
      if (l.status === "won") {
        g.won++;
        g.amountWon += num(l.amount);
      }
      if (l.status === "lost") g.lost++;
    }
    if (l.status === "won") {
      won++;
      amountWon += num(l.amount);
      if (l.closed_at) {
        closeDays += Math.max(0, (Date.parse(l.closed_at) - Date.parse(l.created_at)) / DAY);
        closedWon++;
      }
    } else if (l.status === "lost") {
      lost++;
      amountLost += num(l.amount);
    } else open++;

    // Возражения хранятся списком; старые записи бывают строкой через запятую
    const list = parseJson<unknown>(l.concerns, null);
    const keys = Array.isArray(list) ? list.map(String) : (l.concerns ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    for (const key of keys) concerns.set(key, (concerns.get(key) ?? 0) + 1);

    if (l.unavailable && l.title?.trim()) {
      const title = l.title.trim();
      missing.set(title, (missing.get(title) ?? 0) + 1);
    }
  }

  const withConversion = (g: Group) => ({
    label: g.label,
    value: g.value,
    won: g.won,
    lost: g.lost,
    amountWon: round(g.amountWon),
    conversion: g.won + g.lost > 0 ? share(g.won, g.won + g.lost) : null,
  });

  // Заявки по месяцам за год — сколько людей обращается, независимо от исхода
  const months = lastMonths();
  const monthlyRows = db
    .prepare(
      `SELECT strftime('%Y-%m', created_at) AS month, COUNT(*) AS count,
              COALESCE(SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END), 0) AS won
       FROM leads WHERE created_at >= ?${clientTypeSql("client_type", ctx.type) ? " AND " + clientTypeSql("client_type", ctx.type) : ""}
       GROUP BY month`
    )
    .all(`${months[0]}-01`) as { month: string; count: number; won: number }[];
  const monthly = new Map(monthlyRows.map((r) => [r.month, r]));

  return {
    kpi: {
      leads: leads.length,
      won,
      lost,
      open,
      conversion: won + lost > 0 ? share(won, won + lost) : null,
      amountWon: round(amountWon),
      amountLost: round(amountLost),
      avgCloseDays: closedWon ? round1(closeDays / closedWon) : null,
      unavailable: leads.filter((l) => l.unavailable).length,
      otherCity: leads.filter((l) => l.other_city).length,
    },
    // Стадии в порядке пути клиента — это воронка в прямом смысле слова
    stages: [
      { label: "Обратились", value: leads.length },
      { label: "Дошли до решения", value: won + lost },
      { label: "Взяли в аренду", value: won },
    ],
    bySource: [...bySource.values()].map(withConversion).sort((a, b) => b.value - a.value),
    byManager: [...byManager.values()].map(withConversion).sort((a, b) => b.value - a.value),
    concerns: ranked([...concerns.entries()].map(([key, value]) => ({ label: CONCERN_LABELS[key] ?? key, value }))),
    missing: ranked([...missing.entries()].map(([label, value]) => ({ label, value })), 10),
    monthly: months.map((month) => ({ month, count: monthly.get(month)?.count ?? 0, won: monthly.get(month)?.won ?? 0 })),
  };
}

// ─── Доставка ───────────────────────────────────────────────────────────────

const DELIVERY_STATUS: Record<string, string> = { new: "Новые", in_progress: "В пути", done: "Доставлено", cancelled: "Отменено" };

function delivery(ctx: Ctx) {
  const rows = db
    .prepare(
      `SELECT d.status, d.kind, d.direction, d.price, d.deliver_by, d.started_at, d.completed_at, d.created_at,
              u.name AS courier
       FROM deliveries d LEFT JOIN app_users u ON u.id = d.courier_id
       WHERE d.created_at >= ? AND d.created_at <= ?${rentalIdOfType("d.rental_id", ctx.type)}`
    )
    .all(ctx.from, ctx.to) as {
    status: string;
    kind: string;
    direction: string;
    price: number;
    deliver_by: string | null;
    started_at: string | null;
    completed_at: string | null;
    created_at: string;
    courier: string | null;
  }[];

  const byStatus = new Map<string, number>();
  const byCourier = new Map<string, { label: string; value: number; done: number; income: number; onTime: number; timed: number }>();
  let to = 0;
  let from = 0;
  let income = 0;
  let onTime = 0;
  let timed = 0;
  let leadHours = 0;
  let leadCount = 0;

  for (const d of rows) {
    byStatus.set(d.status, (byStatus.get(d.status) ?? 0) + 1);
    if (d.direction === "from") from++;
    else to++;
    const courier = d.courier || "Не назначен";
    const c = byCourier.get(courier) ?? { label: courier, value: 0, done: 0, income: 0, onTime: 0, timed: 0 };
    c.value++;
    if (d.status === "done") {
      c.done++;
      c.income += num(d.price);
      income += num(d.price);
      if (d.completed_at && d.deliver_by) {
        const ok = Date.parse(d.completed_at) <= Date.parse(d.deliver_by) + 15 * 60000;
        c.timed++;
        timed++;
        if (ok) {
          c.onTime++;
          onTime++;
        }
      }
      if (d.completed_at) {
        leadHours += Math.max(0, (Date.parse(d.completed_at) - Date.parse(d.created_at)) / 3600000);
        leadCount++;
      }
    }
    byCourier.set(courier, c);
  }

  const done = byStatus.get("done") ?? 0;
  return {
    kpi: {
      count: rows.length,
      done,
      cancelled: byStatus.get("cancelled") ?? 0,
      income: round(income),
      avgPrice: done ? round(income / done) : 0,
      onTimeShare: timed ? share(onTime, timed) : null,
      avgHours: leadCount ? round1(leadHours / leadCount) : null,
    },
    byStatus: [...byStatus.entries()].map(([key, value]) => ({ key, label: DELIVERY_STATUS[key] ?? key, value })),
    directions: [
      { label: "Везём клиенту", value: to },
      { label: "Забираем у клиента", value: from },
    ],
    byCourier: [...byCourier.values()]
      .map((c) => ({ ...c, income: round(c.income), onTimeShare: c.timed ? share(c.onTime, c.timed) : null }))
      .sort((a, b) => b.value - a.value),
  };
}

// ─── Магазин ────────────────────────────────────────────────────────────────

function shop(ctx: Ctx) {
  const products = db
    .prepare(`SELECT id, name, category, price, purchase_cost, qty FROM shop_products`)
    .all() as { id: string; name: string; category: string | null; price: number; purchase_cost: number | null; qty: number }[];

  // Продажи — строки магазина внутри аренд периода, с тем же отбором по клиенту
  const sold = new Map<string, { label: string; value: number; revenue: number }>();
  for (const r of periodRentals(ctx)) {
    for (const line of parseLines(r.items_json)) {
      if (line.category !== "shop") continue;
      const key = (line.name || "").trim().toLowerCase();
      if (!key) continue;
      const entry = sold.get(key) ?? { label: line.name, value: 0, revenue: 0 };
      entry.value += num(line.qty);
      entry.revenue += num(line.qty) * num(line.pricePerDay);
      sold.set(key, entry);
    }
  }
  const soldNames = new Set(sold.keys());

  const stockUnits = products.reduce((s, p) => s + num(p.qty), 0);
  const stockValue = products.reduce((s, p) => s + num(p.qty) * num(p.price), 0);
  const stockCost = products.reduce((s, p) => s + num(p.qty) * num(p.purchase_cost), 0);
  const salesRevenue = [...sold.values()].reduce((s, e) => s + e.revenue, 0);
  const salesUnits = [...sold.values()].reduce((s, e) => s + e.value, 0);

  // Наценка — только там, где известна закупка, иначе она врала бы вверх
  const priced = products.filter((p) => num(p.purchase_cost) > 0 && num(p.price) > 0);
  const avgMarkup = priced.length
    ? round((priced.reduce((s, p) => s + (num(p.price) - num(p.purchase_cost)) / num(p.purchase_cost), 0) / priced.length) * 100)
    : null;

  const byCategory = new Map<string, number>();
  for (const p of products) byCategory.set(p.category || "Без категории", (byCategory.get(p.category || "Без категории") ?? 0) + num(p.qty) * num(p.price));

  return {
    kpi: {
      products: products.length,
      stockUnits: round(stockUnits),
      stockValue: round(stockValue),
      stockCost: round(stockCost),
      salesRevenue: round(salesRevenue),
      salesUnits: round(salesUnits),
      avgMarkup,
      outOfStock: products.filter((p) => num(p.qty) <= 0).length,
    },
    topSold: ranked([...sold.values()].map((e) => ({ ...e, revenue: round(e.revenue) })), 10),
    lowStock: products
      .filter((p) => num(p.qty) <= 2)
      .sort((a, b) => num(a.qty) - num(b.qty))
      .slice(0, 12)
      .map((p) => ({ label: p.name, value: num(p.qty) })),
    neverSold: products.filter((p) => !soldNames.has(p.name.trim().toLowerCase()) && num(p.qty) > 0).length,
    stockByCategory: ranked([...byCategory.entries()].map(([label, value]) => ({ label, value: round(value) }))),
  };
}

// ─── Услуги и комплекты ─────────────────────────────────────────────────────

function services(ctx: Ctx) {
  const used = { service: new Map<string, { label: string; value: number; revenue: number }>(), kit: new Map<string, { label: string; value: number; revenue: number }>() };
  let rentalsWithService = 0;
  let rentalsWithKit = 0;
  const rentals = periodRentals(ctx);
  for (const r of rentals) {
    let hasService = false;
    let hasKit = false;
    for (const line of parseLines(r.items_json)) {
      if (line.category !== "service" && line.category !== "kit") continue;
      if (line.category === "service") hasService = true;
      else hasKit = true;
      const map = used[line.category];
      const key = (line.name || "").trim().toLowerCase();
      const entry = map.get(key) ?? { label: line.name, value: 0, revenue: 0 };
      entry.value += num(line.qty) || 1;
      entry.revenue += num(line.qty) * num(line.pricePerDay);
      map.set(key, entry);
    }
    if (hasService) rentalsWithService++;
    if (hasKit) rentalsWithKit++;
  }

  const serviceNames = (db.prepare(`SELECT name FROM services`).all() as { name: string }[]).map((s) => s.name);
  const kitNames = (db.prepare(`SELECT name FROM kits`).all() as { name: string }[]).map((s) => s.name);
  const unused = (names: string[], map: Map<string, unknown>) => names.filter((n) => !map.has(n.trim().toLowerCase()));

  const sum = (map: Map<string, { revenue: number }>) => round([...map.values()].reduce((s, e) => s + e.revenue, 0));
  return {
    kpi: {
      services: serviceNames.length,
      kits: kitNames.length,
      serviceRevenue: sum(used.service),
      kitRevenue: sum(used.kit),
      serviceShare: share(rentalsWithService, rentals.length),
      kitShare: share(rentalsWithKit, rentals.length),
    },
    topServices: ranked([...used.service.values()].map((e) => ({ ...e, revenue: round(e.revenue) }))),
    topKits: ranked([...used.kit.values()].map((e) => ({ ...e, revenue: round(e.revenue) }))),
    unusedServices: unused(serviceNames, used.service).slice(0, 12),
    unusedKits: unused(kitNames, used.kit).slice(0, 12),
  };
}

// ─── Команда ────────────────────────────────────────────────────────────────

function team(ctx: Ctx) {
  interface Person {
    name: string;
    booked: number;
    issued: number;
    payments: number;
    paymentsSum: number;
    leads: number;
    won: number;
    lost: number;
    deliveries: number;
  }
  const people = new Map<string, Person>();
  const person = (raw: string | null) => {
    const name = (raw ?? "").trim();
    // «Импорт» — не человек: так подписаны аренды, загруженные из старой системы
    if (!name || name === "Импорт") return null;
    let p = people.get(name);
    if (!p) {
      p = { name, booked: 0, issued: 0, payments: 0, paymentsSum: 0, leads: 0, won: 0, lost: 0, deliveries: 0 };
      people.set(name, p);
    }
    return p;
  };

  for (const r of periodRentals(ctx)) {
    const b = person(r.booked_by_name);
    if (b) b.booked++;
    const i = person(r.issued_by_name);
    if (i) i.issued++;
  }

  for (const p of db
    .prepare(
      `SELECT created_by, amount FROM rental_payments
       WHERE created_at >= ? AND created_at <= ?${rentalIdOfType("rental_id", ctx.type)}`
    )
    .all(ctx.from, ctx.to) as { created_by: string | null; amount: number }[]) {
    const who = person(p.created_by);
    if (who) {
      who.payments++;
      who.paymentsSum += num(p.amount);
    }
  }

  const leadType = clientTypeSql("l.client_type", ctx.type);
  for (const l of db
    .prepare(
      `SELECT u.name, l.status FROM leads l JOIN app_users u ON u.id = l.manager_id
       WHERE l.created_at >= ? AND l.created_at <= ?${leadType ? " AND " + leadType : ""}`
    )
    .all(ctx.from, ctx.to) as { name: string; status: string }[]) {
    const who = person(l.name);
    if (!who) continue;
    who.leads++;
    if (l.status === "won") who.won++;
    if (l.status === "lost") who.lost++;
  }

  for (const d of db
    .prepare(
      `SELECT u.name FROM deliveries d JOIN app_users u ON u.id = d.courier_id
       WHERE d.status = 'done' AND d.created_at >= ? AND d.created_at <= ?${rentalIdOfType("d.rental_id", ctx.type)}`
    )
    .all(ctx.from, ctx.to) as { name: string }[]) {
    const who = person(d.name);
    if (who) who.deliveries++;
  }

  const rows = [...people.values()]
    .map((p) => ({
      ...p,
      paymentsSum: round(p.paymentsSum),
      conversion: p.won + p.lost > 0 ? share(p.won, p.won + p.lost) : null,
      // Вес для сортировки: сколько всего человек сделал за период
      total: p.booked + p.issued + p.payments + p.leads + p.deliveries,
    }))
    .sort((a, b) => b.total - a.total);

  return { rows };
}

// ─── Риски и долги ──────────────────────────────────────────────────────────

function risks(ctx: Ctx) {
  const R = clientIdOfType("r.client_id", ctx.type);
  const debts = db
    .prepare(
      `SELECT r.id, r.number, r.status, r.total, r.paid, r.end_at, c.name AS client_name, c.id AS client_id
       FROM rentals r LEFT JOIN clients c ON c.id = r.client_id
       WHERE r.total - r.paid > 0.5 AND r.status NOT IN ('cancelled','request')${R}`
    )
    .all() as { id: string; number: string; status: string; total: number; paid: number; end_at: string; client_name: string | null; client_id: string }[];

  // Возраст долга — от срока возврата: чем он старше, тем меньше шансов его вернуть
  const aging = [
    { label: "Ещё не наступил срок", value: 0, amount: 0 },
    { label: "До недели", value: 0, amount: 0 },
    { label: "8–30 дней", value: 0, amount: 0 },
    { label: "31–90 дней", value: 0, amount: 0 },
    { label: "Больше 90 дней", value: 0, amount: 0 },
  ];
  const byClient = new Map<string, { id: string; label: string; value: number; rentals: number }>();
  for (const d of debts) {
    const debt = num(d.total) - num(d.paid);
    const age = (ctx.now - Date.parse(d.end_at)) / DAY;
    const bucket = age < 0 ? 0 : age <= 7 ? 1 : age <= 30 ? 2 : age <= 90 ? 3 : 4;
    aging[bucket].value++;
    aging[bucket].amount += debt;
    const c = byClient.get(d.client_id) ?? { id: d.client_id, label: d.client_name ?? "Клиент", value: 0, rentals: 0 };
    c.value += debt;
    c.rentals++;
    byClient.set(d.client_id, c);
  }

  const overdue = db
    .prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(total - paid), 0) AS debt FROM rentals r WHERE r.status = 'overdue'${R}`)
    .get() as { n: number; debt: number };
  const stolen = db
    .prepare(
      `SELECT COUNT(*) AS n, COALESCE(SUM(total), 0) AS amount FROM rentals r
       WHERE r.status = 'stolen' AND r.created_at >= ? AND r.created_at <= ?${R}`
    )
    .get(ctx.from, ctx.to) as { n: number; amount: number };

  const typeOnly = clientTypeSql("type", ctx.type);
  const blacklist = db
    .prepare(
      `SELECT COUNT(*) AS total,
              COALESCE(SUM(CASE WHEN blacklisted_at >= ? AND blacklisted_at <= ? THEN 1 ELSE 0 END), 0) AS added
       FROM clients WHERE blacklisted = 1${typeOnly ? " AND " + typeOnly : ""}`
    )
    .get(ctx.from, ctx.to) as { total: number; added: number };

  const shortages = db
    .prepare(
      `SELECT COALESCE(SUM(CASE WHEN resolved = 0 THEN 1 ELSE 0 END), 0) AS open,
              COALESCE(SUM(CASE WHEN resolved = 1 AND resolved_at >= ? AND resolved_at <= ? THEN 1 ELSE 0 END), 0) AS closed,
              COALESCE(SUM(CASE WHEN created_at >= ? AND created_at <= ? THEN 1 ELSE 0 END), 0) AS added
       FROM return_shortages WHERE 1=1${rentalIdOfType("rental_id", ctx.type)}`
    )
    .get(ctx.from, ctx.to, ctx.from, ctx.to) as { open: number; closed: number; added: number };

  const debtTotal = debts.reduce((s, d) => s + num(d.total) - num(d.paid), 0);
  return {
    kpi: {
      debtTotal: round(debtTotal),
      debtors: byClient.size,
      overdue: overdue.n,
      overdueDebt: round(overdue.debt),
      stolen: stolen.n,
      stolenAmount: round(stolen.amount),
      blacklisted: blacklist.total,
      blacklistedAdded: blacklist.added,
      shortagesOpen: shortages.open,
      shortagesAdded: shortages.added,
      shortagesClosed: shortages.closed,
    },
    aging: aging.map((a) => ({ ...a, amount: round(a.amount) })),
    topDebtors: ranked([...byClient.values()].map((c) => ({ ...c, value: round(c.value) })), 10),
  };
}

export function buildDeepSection(section: DeepSection, from: string, to: string, type: ClientTypeFilter) {
  const ctx: Ctx = { from, to, type, now: Date.now() };
  switch (section) {
    case "overview":
      return overview(ctx);
    case "rentals":
      return rentalsSection(ctx);
    case "funnel":
      return funnel(ctx);
    case "delivery":
      return delivery(ctx);
    case "shop":
      return shop(ctx);
    case "services":
      return services(ctx);
    case "team":
      return team(ctx);
    case "risks":
      return risks(ctx);
  }
}

// Формы данных разделов — для страницы отчёта (импортируются только как типы)
export type OverviewData = ReturnType<typeof overview>;
export type RentalsData = ReturnType<typeof rentalsSection>;
export type FunnelData = ReturnType<typeof funnel>;
export type DeliveryData = ReturnType<typeof delivery>;
export type ShopData = ReturnType<typeof shop>;
export type ServicesData = ReturnType<typeof services>;
export type TeamData = ReturnType<typeof team>;
export type RisksData = ReturnType<typeof risks>;
