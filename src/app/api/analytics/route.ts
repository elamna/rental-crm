import { NextRequest, NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/auth";
import { db } from "@/lib/db";
import { resolvePeriod } from "@/lib/period";
import { clientIdOfType, clientTypeSql, parseClientTypeFilter } from "@/lib/client-type";
import { bucketRange, cashEntries, debtNow, localKey, REAL_RENTAL } from "@/lib/analytics-core";
import type { InventoryLine } from "@/lib/types";

/**
 * Главная страница аналитики.
 *
 * Все определения — из lib/analytics-core: «поступления» — деньги по дню, когда
 * их приняли; «аренды» — без черновиков и отмен; «долг» — остаток по выданному
 * инструменту; дни и часы — по времени браузера. Раньше «выручка» считала
 * оплату аренд, оформленных в периоде, и деньги, принятые сегодня за прошлую
 * аренду, в сегодняшние цифры не попадали.
 */
export async function GET(req: NextRequest) {
  try {
    await requireAuth("analytics.view");
  } catch (e) {
    return apiError(e);
  }

  const params = req.nextUrl.searchParams;
  const { period, from, to, granularity, tz } = resolvePeriod(params);
  const clientType = parseClientTypeFilter(params.get("clientType"));
  const R = clientIdOfType("client_id", clientType);
  const typeOnly = clientTypeSql("type", clientType);
  const C = typeOnly ? ` AND ${typeOnly}` : "";

  // ── Деньги за период ───────────────────────────────────────────────────
  const cash = cashEntries(from, to, clientType);
  const cashDelivery = cash.filter((e) => e.kind === "delivery").reduce((s, e) => s + e.amount, 0);
  const cashRent = cash.filter((e) => e.kind !== "delivery").reduce((s, e) => s + e.amount, 0);

  // ── Аренды, оформленные в периоде ──────────────────────────────────────
  const rentals = db
    .prepare(
      `SELECT id, client_id, status, total, items_json, created_at FROM rentals
       WHERE created_at >= ? AND created_at <= ?${R}`
    )
    .all(from, to) as { id: string; client_id: string; status: string; total: number; items_json: string; created_at: string }[];
  const real = rentals.filter((r) => r.status !== "cancelled" && r.status !== "request");
  const billed = real.reduce((s, r) => s + (Number(r.total) || 0), 0);

  // ── Сейчас ─────────────────────────────────────────────────────────────
  const count = (sql: string, ...args: unknown[]) => (db.prepare(sql).get(...args) as { v: number }).v;
  const activeRentals = count(`SELECT COUNT(*) AS v FROM rentals WHERE status = 'active'${R}`);
  const bookedRentals = count(`SELECT COUNT(*) AS v FROM rentals WHERE status = 'booked'${R}`);
  const overdueRentals = count(`SELECT COUNT(*) AS v FROM rentals WHERE status = 'overdue'${R}`);
  const debt = debtNow(clientType);
  const newClients = count(`SELECT COUNT(*) AS v FROM clients WHERE created_at >= ? AND created_at <= ?${C}`, from, to);
  const totalClients = count(`SELECT COUNT(*) AS v FROM clients WHERE 1=1${C}`);
  const freeInventory = count(`SELECT COUNT(*) AS v FROM inventory_items WHERE status = 'available'`);
  const totalInventory = count(`SELECT COUNT(*) AS v FROM inventory_items`);
  const workshopActive = count(`SELECT COUNT(*) AS v FROM workshop_tickets WHERE status NOT IN ('done','archived')`);

  // ── График: поступления и число аренд по местным дням/часам/месяцам ────
  // За «всё время» ось начинается с первых данных, а не с 2000 года
  let axisFrom = from;
  if (period === "all") {
    const first = db
      .prepare(
        `SELECT MIN(at) AS v FROM (
           SELECT MIN(created_at) AS at FROM rentals WHERE 1=1${R}
           UNION ALL SELECT MIN(created_at) FROM rental_payments
           UNION ALL SELECT MIN(COALESCE(paid_at, created_at)) FROM rentals WHERE paid > 0${R})`
      )
      .get() as { v: string | null };
    if (first.v && first.v > from) axisFrom = first.v;
  }
  const buckets = new Map(bucketRange(axisFrom, to, tz, granularity).map((key) => [key, { day: key, revenue: 0, count: 0 }]));
  const bucketOf = (iso: string) => {
    const key = localKey(iso, tz, granularity);
    let b = buckets.get(key);
    if (!b) {
      b = { day: key, revenue: 0, count: 0 };
      buckets.set(key, b);
    }
    return b;
  };
  for (const e of cash) bucketOf(e.at).revenue += e.amount;
  for (const r of real) bucketOf(r.created_at).count += 1;
  const revenueByDay = [...buckets.values()]
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((b) => ({ ...b, revenue: Math.round(b.revenue) }));

  // ── Топ клиентов: кто принёс деньги в периоде ─────────────────────────
  const byClient = new Map<string, { paid: number; rentals: number }>();
  for (const e of cash) {
    if (!e.clientId) continue;
    const c = byClient.get(e.clientId) ?? { paid: 0, rentals: 0 };
    c.paid += e.amount;
    byClient.set(e.clientId, c);
  }
  for (const r of real) {
    const c = byClient.get(r.client_id) ?? { paid: 0, rentals: 0 };
    c.rentals += 1;
    byClient.set(r.client_id, c);
  }
  const topIds = [...byClient.entries()].sort((a, b) => b[1].paid - a[1].paid || b[1].rentals - a[1].rentals).slice(0, 10);
  const clientInfo = db.prepare(`SELECT id, name, phone FROM clients WHERE id = ?`);
  const clientDebt = db.prepare(
    `SELECT COALESCE(SUM(total - paid), 0) AS v FROM rentals
     WHERE client_id = ? AND total - paid > 0.5 AND status IN ('active','overdue','completed','stolen')`
  );
  const topClients = topIds
    .map(([id, v]) => {
      const info = clientInfo.get(id) as { id: string; name: string; phone: string } | undefined;
      if (!info) return null;
      return {
        id,
        name: info.name,
        phone: info.phone,
        rentals_count: v.rentals,
        total_paid: Math.round(v.paid),
        total_debt: Math.round((clientDebt.get(id) as { v: number }).v),
      };
    })
    .filter((x): x is NonNullable<typeof x> => !!x);

  // ── Популярный инвентарь: сколько раз брали и на какую сумму ───────────
  // Сумма — доля позиции в стоимости аренды по весу строк: скидка и тариф
  // учитываются, а не «цена за сутки × количество», как было раньше
  const inventory: Record<string, { name: string; count: number; revenue: number }> = {};
  for (const r of real) {
    let lines: InventoryLine[] = [];
    try {
      const parsed = JSON.parse(r.items_json || "[]");
      lines = Array.isArray(parsed) ? parsed : [];
    } catch {
      lines = [];
    }
    const weights = lines.map((l) => (Number(l.pricePerDay) || 0) * (Number(l.qty) || 0));
    const sum = weights.reduce((a, b) => a + b, 0);
    lines.forEach((l, i) => {
      if (l.category === "shop") return;
      const key = (l.name || "").trim().toLowerCase();
      if (!key) return;
      const entry = inventory[key] ?? (inventory[key] = { name: l.name, count: 0, revenue: 0 });
      entry.count += Number(l.qty) || 0;
      entry.revenue += sum > 0 ? ((Number(r.total) || 0) * weights[i]) / sum : 0;
    });
  }
  const topInventory = Object.values(inventory)
    .map((i) => ({ ...i, revenue: Math.round(i.revenue) }))
    .sort((a, b) => b.count - a.count || b.revenue - a.revenue)
    .slice(0, 10);

  // ── Аренды периода по статусам — здесь и черновики, и отмены: это разбивка ──
  const statusMap = new Map<string, number>();
  for (const r of rentals) statusMap.set(r.status, (statusMap.get(r.status) ?? 0) + 1);
  const byStatus = [...statusMap.entries()].map(([status, c]) => ({ status, count: c }));

  // ── За всё время ───────────────────────────────────────────────────────
  const allCash = cashEntries("0000", "9999", clientType).reduce((s, e) => s + e.amount, 0);
  const allReal = db
    .prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(total), 0) AS billed FROM rentals WHERE ${REAL_RENTAL}${R}`)
    .get() as { n: number; billed: number };

  return NextResponse.json({
    period,
    granularity,
    from,
    to,
    summary: {
      // Поступления: аренда (с магазином) и доставка — сумма денег за период
      totalRevenue: Math.round(cashRent + cashDelivery),
      cashRent: Math.round(cashRent),
      cashDelivery: Math.round(cashDelivery),
      // Оформлено в периоде: сколько аренд и на какую сумму
      totalRentals: real.length,
      billed: Math.round(billed),
      avgCheck: real.length ? Math.round(billed / real.length) : 0,
      activeRentals,
      bookedRentals,
      overdueRentals,
      totalDebt: Math.round(debt.amount),
      debtors: debt.debtors,
      newClients,
      totalClients,
      freeInventory,
      totalInventory,
      workshopActive,
    },
    allTime: {
      revenue: Math.round(allCash),
      rentals: allReal.n,
      debt: Math.round(debt.amount),
      // Средний чек — стоимость аренды, а не то, сколько по ней успели заплатить
      avgCheck: allReal.n ? Math.round(allReal.billed / allReal.n) : 0,
    },
    revenueByDay,
    topClients,
    topInventory,
    byStatus,
  });
}
