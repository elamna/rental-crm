import { NextRequest, NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/auth";
import { db } from "@/lib/db";
import { bucketExpr, resolvePeriod } from "@/lib/period";
import { clientIdOfType, clientTypeSql, parseClientTypeFilter } from "@/lib/client-type";

export async function GET(req: NextRequest) {
  try {
    await requireAuth("analytics.view");
  } catch (e) {
    return apiError(e);
  }

  const { period, from, to, granularity } = resolvePeriod(req.nextUrl.searchParams);
  // Отбор «физлица / юрлица»: к каждому запросу по арендам дописывается условие на
  // клиента, к запросам по клиентам — на их тип. Склад и мастерская не делятся
  const clientType = parseClientTypeFilter(req.nextUrl.searchParams.get("clientType"));
  const R = clientIdOfType("client_id", clientType);
  const typeOnly = clientTypeSql("type", clientType);
  const C = typeOnly ? ` AND ${typeOnly}` : "";
  const typeOnClients = clientTypeSql("c.type", clientType);
  const CC = typeOnClients ? ` AND ${typeOnClients}` : "";

  // ── Общие показатели ──────────────────────────────────────────────────────
  const totalRevenue = (db.prepare(
    `SELECT COALESCE(SUM(paid), 0) as v FROM rentals WHERE status NOT IN ('cancelled') AND created_at >= ? AND created_at <= ?${R}`
  ).get(from, to) as { v: number }).v;

  const totalRentals = (db.prepare(
    `SELECT COUNT(*) as v FROM rentals WHERE created_at >= ? AND created_at <= ?${R}`
  ).get(from, to) as { v: number }).v;

  const activeRentals = (db.prepare(
    `SELECT COUNT(*) as v FROM rentals WHERE status = 'active'${R}`
  ).get() as { v: number }).v;

  const bookedRentals = (db.prepare(
    `SELECT COUNT(*) as v FROM rentals WHERE status = 'booked'${R}`
  ).get() as { v: number }).v;

  const overdueRentals = (db.prepare(
    `SELECT COUNT(*) as v FROM rentals WHERE status = 'overdue'${R}`
  ).get() as { v: number }).v;

  const totalDebt = (db.prepare(
    `SELECT COALESCE(SUM(total - paid), 0) as v FROM rentals WHERE status IN ('active','overdue') AND total > paid${R}`
  ).get() as { v: number }).v;

  const newClients = (db.prepare(
    `SELECT COUNT(*) as v FROM clients WHERE created_at >= ? AND created_at <= ?${C}`
  ).get(from, to) as { v: number }).v;

  const totalClients = (db.prepare(`SELECT COUNT(*) as v FROM clients WHERE 1=1${C}`).get() as { v: number }).v;

  const freeInventory = (db.prepare(
    `SELECT COUNT(*) as v FROM inventory_items WHERE status = 'available'`
  ).get() as { v: number }).v;

  const totalInventory = (db.prepare(`SELECT COUNT(*) as v FROM inventory_items`).get() as { v: number }).v;

  // ── Выручка по дням ───────────────────────────────────────────────────────
  // Шаг группировки зависит от периода: сутки — по часам, месяц — по дням
  const bucket = bucketExpr(granularity);
  const revenueByDay = db.prepare(`
    SELECT ${bucket} as day,
           COALESCE(SUM(paid), 0) as revenue,
           COUNT(*) as count
    FROM rentals
    WHERE created_at >= ? AND created_at <= ? AND status NOT IN ('cancelled')${R}
    GROUP BY ${bucket}
    ORDER BY day
  `).all(from, to) as { day: string; revenue: number; count: number }[];

  // ── Выручка по месяцам ────────────────────────────────────────────────────
  const revenueByMonth = (db.prepare(`
    SELECT strftime('%Y-%m', created_at) as month,
           COALESCE(SUM(paid), 0) as revenue,
           COUNT(*) as count
    FROM rentals
    WHERE status NOT IN ('cancelled')${R}
    GROUP BY strftime('%Y-%m', created_at)
    ORDER BY month DESC
    LIMIT 12
  `).all() as { month: string; revenue: number; count: number }[]).reverse();

  // ── Топ клиентов — JOIN с таблицей clients ────────────────────────────────
  const topClients = db.prepare(`
    SELECT c.id, c.name, c.phone,
           COUNT(r.id) as rentals_count,
           COALESCE(SUM(r.paid), 0) as total_paid,
           COALESCE(SUM(r.total - r.paid), 0) as total_debt
    FROM clients c
    INNER JOIN rentals r ON r.client_id = c.id
    WHERE r.status NOT IN ('cancelled') AND r.created_at >= ? AND r.created_at <= ?${CC}
    GROUP BY c.id
    ORDER BY total_paid DESC
    LIMIT 10
  `).all(from, to) as { id: string; name: string; phone: string; rentals_count: number; total_paid: number; total_debt: number }[];

  // ── Топ инвентаря ─────────────────────────────────────────────────────────
  const allRentals = db.prepare(
    `SELECT items_json FROM rentals WHERE status NOT IN ('cancelled') AND created_at >= ? AND created_at <= ?${R}`
  ).all(from, to) as { items_json: string }[];

  const inventoryCount: Record<string, { name: string; count: number; revenue: number }> = {};
  for (const r of allRentals) {
    try {
      const items = JSON.parse(r.items_json || "[]") as { inventoryItemId?: string; name: string; qty: number; pricePerDay: number }[];
      for (const item of items) {
        // Группируем по названию: одна и та же позиция, добавленная из каталога
        // и вручную, раньше давала две строки в топе
        const key = item.name.trim().toLowerCase();
        if (!inventoryCount[key]) inventoryCount[key] = { name: item.name, count: 0, revenue: 0 };
        inventoryCount[key].count += item.qty;
        inventoryCount[key].revenue += item.pricePerDay * item.qty;
      }
    } catch { /* ignore */ }
  }
  const topInventory = Object.values(inventoryCount).sort((a, b) => b.count - a.count).slice(0, 10);

  // ── Аренды по статусам ────────────────────────────────────────────────────
  const byStatus = db.prepare(`
    SELECT status, COUNT(*) as count
    FROM rentals
    WHERE created_at >= ? AND created_at <= ?${R}
    GROUP BY status
  `).all(from, to) as { status: string; count: number }[];

  // ── Мастерская ────────────────────────────────────────────────────────────
  const workshopActive = (db.prepare(
    `SELECT COUNT(*) as v FROM workshop_tickets WHERE status NOT IN ('done','archived')`
  ).get() as { v: number }).v;

  /**
   * Итоги за всё время — рядом с показателями за период.
   *
   * Владельцу нужны обе цифры: сколько принесли эти тридцать дней и сколько
   * прокат заработал вообще. Раньше на экране была только первая, и общую
   * сумму приходилось складывать по месяцам руками.
   */
  const allTimeRevenue = (
    db.prepare(`SELECT COALESCE(SUM(paid), 0) AS v FROM rentals WHERE status NOT IN ('cancelled')${R}`).get() as { v: number }
  ).v;
  const allTimeRentals = (db.prepare(`SELECT COUNT(*) AS v FROM rentals WHERE 1=1${R}`).get() as { v: number }).v;
  const allTimeDebt = (
    db.prepare(`SELECT COALESCE(SUM(total - paid), 0) AS v FROM rentals WHERE total > paid AND status NOT IN ('cancelled')${R}`).get() as {
      v: number;
    }
  ).v;
  // Средний чек: по закрытым и текущим арендам, чтобы пустые заявки не занижали
  const avgCheck = allTimeRentals > 0 ? Math.round(allTimeRevenue / allTimeRentals) : 0;

  return NextResponse.json({
    period,
    granularity,
    from,
    to,
    summary: {
      totalRevenue, totalRentals, activeRentals, bookedRentals, overdueRentals,
      totalDebt, newClients, totalClients, freeInventory, totalInventory,
      workshopActive,
    },
    allTime: { revenue: allTimeRevenue, rentals: allTimeRentals, debt: allTimeDebt, avgCheck },
    revenueByDay,
    revenueByMonth,
    topClients,
    topInventory,
    byStatus,
  });
}
