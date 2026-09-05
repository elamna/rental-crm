import * as XLSX from "xlsx";
import { InventoryCheck, InventoryItem, Kit, Rental, Service, ServiceTariffType } from "./types";

// ---------- Продукты: группировка единиц каталога ----------

/**
 * Продукт — это группа физических единиц каталога с одинаковым названием.
 * Поштучный учёт остаётся прежним (у каждой единицы свой артикул, QR и статус),
 * вкладка «Продукты» просто показывает их свёрнутыми.
 */
export interface ProductGroup {
  key: string;
  name: string;
  category: string;
  /** Артикул: общий, если совпадает у всех единиц, иначе префикс */
  sku: string;
  photoUrl?: string;
  price: number;
  units: InventoryItem[];
  total: number;
  free: number;
  booked: number;
  rented: number;
  broken: number;
  repair: number;
  inactive: number;
}

const ACTIVE_BOOKING_STATUSES = new Set(["booked", "request"]);

export function groupProducts(inventory: InventoryItem[], rentals: Rental[]): ProductGroup[] {
  // id единиц, которые заняты будущей бронью (аренда ещё не выдана)
  const bookedIds = new Set<string>();
  for (const r of rentals) {
    if (!ACTIVE_BOOKING_STATUSES.has(r.status)) continue;
    for (const line of r.items) if (line.inventoryItemId) bookedIds.add(line.inventoryItemId);
  }

  const map = new Map<string, ProductGroup>();
  for (const item of inventory) {
    const key = item.name.trim().toLowerCase();
    let g = map.get(key);
    if (!g) {
      g = {
        key,
        name: item.name,
        category: item.category,
        sku: item.sku,
        photoUrl: item.photoUrl,
        price: item.rentalPricePerDay,
        units: [],
        total: 0,
        free: 0,
        booked: 0,
        rented: 0,
        broken: 0,
        repair: 0,
        inactive: 0,
      };
      map.set(key, g);
    }
    g.units.push(item);
    g.total += 1;
    if (!g.photoUrl && item.photoUrl) g.photoUrl = item.photoUrl;
    if (item.sku && g.sku && item.sku !== g.sku) g.sku = commonSkuPrefix(g.sku, item.sku);

    switch (item.status) {
      case "available":
        if (bookedIds.has(item.id)) g.booked += 1;
        else g.free += 1;
        break;
      case "rented":
        g.rented += 1;
        break;
      case "maintenance":
        g.broken += 1;
        break;
      case "repair":
        g.repair += 1;
        break;
      default: // stolen | written_off
        g.inactive += 1;
    }
  }

  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

function commonSkuPrefix(a: string, b: string) {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  const prefix = a.slice(0, i).replace(/[.\-_\s]+$/, "");
  return prefix || "—";
}

/** Единицы, которые не сдаются в аренду: украдены или списаны */
export function isInactiveUnit(item: InventoryItem) {
  return item.status === "stolen" || item.status === "written_off";
}

// ---------- Комплекты ----------

/**
 * Сколько комплектов можно собрать прямо сейчас.
 * null — состав не привязан к каталогу, ограничения нет (∞).
 */
export function kitAvailability(kit: Kit, groups: ProductGroup[]): { free: number | null; total: number | null } {
  const linked = kit.lines.filter((l) => l.inventoryName);
  if (linked.length === 0) return { free: null, total: null };

  let free = Infinity;
  let total = Infinity;
  for (const line of linked) {
    const g = groups.find((x) => x.key === (line.inventoryName ?? "").trim().toLowerCase());
    const qty = Math.max(1, line.qty);
    free = Math.min(free, Math.floor((g?.free ?? 0) / qty));
    total = Math.min(total, Math.floor((g?.total ?? 0) / qty));
  }
  return { free: Number.isFinite(free) ? free : 0, total: Number.isFinite(total) ? total : 0 };
}

export function kitPrice(kit: Kit) {
  if (kit.price > 0) return kit.price;
  return kit.lines.reduce((s, l) => s + l.price * l.qty, 0);
}

/** Выручка по позиции каталога — сумма по всем арендам, где она встречалась */
export function revenueByName(rentals: Rental[], name: string) {
  const needle = name.trim().toLowerCase();
  let sum = 0;
  for (const r of rentals) {
    if (r.status === "cancelled" || r.status === "request") continue;
    for (const line of r.items) {
      if (line.name.trim().toLowerCase() === needle) sum += line.pricePerDay * line.qty;
    }
  }
  return sum;
}

export function usageCountByName(rentals: Rental[], name: string) {
  const needle = name.trim().toLowerCase();
  let count = 0;
  for (const r of rentals) {
    if (r.status === "cancelled" || r.status === "request") continue;
    if (r.items.some((l) => l.name.trim().toLowerCase() === needle)) count += 1;
  }
  return count;
}

// ---------- Услуги ----------

export const serviceTariffLabels: Record<ServiceTariffType, string> = {
  day: "День",
  once: "разовая",
  period: "за период",
};

export function formatTariffs(service: Service) {
  if (service.tariffs.length === 0) return "";
  const day = service.tariffs.find((t) => t.type === "day");
  const rest = service.tariffs.filter((t) => t.type !== "day");
  const restLabel = rest.map((t) => serviceTariffLabels[t.type]).join(",");
  if (day && rest.length) return `День (${restLabel})`;
  if (day) return "День";
  return restLabel;
}

export function servicePrice(service: Service) {
  if (service.tariffs.length === 0) return 0;
  return Math.max(...service.tariffs.map((t) => t.price));
}

// ---------- Инвентаризация ----------

export function lastCheckByItem(checks: InventoryCheck[]) {
  const map = new Map<string, InventoryCheck>();
  // checks приходят отсортированными по убыванию даты — берём первую встреченную
  for (const c of checks) if (!map.has(c.inventoryItemId)) map.set(c.inventoryItemId, c);
  return map;
}

/** Последняя аренда, в которой участвовала единица инвентаря */
export function lastRentalByItem(rentals: Rental[]) {
  const map = new Map<string, Rental>();
  const sorted = [...rentals].sort((a, b) => (b.startAt ?? b.startDate).localeCompare(a.startAt ?? a.startDate));
  for (const r of sorted) {
    for (const line of r.items) {
      if (line.inventoryItemId && !map.has(line.inventoryItemId)) map.set(line.inventoryItemId, r);
    }
  }
  return map;
}

// ---------- Экспорт ----------

export function exportRows(rows: Record<string, unknown>[], sheet: string, filename: string) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheet);
  XLSX.writeFile(wb, filename);
}
