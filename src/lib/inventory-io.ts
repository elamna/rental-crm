import * as XLSX from "xlsx";
import { InventoryItem } from "./types";
import { normalizeHeader, parseImportDate, parseNumber, parseTariffHeader } from "./import-utils";

export type InventoryImportRow = Partial<InventoryItem> & { quantity?: number };

const HEADER_ALIASES: Record<string, keyof InventoryItem | "quantity"> = {
  "название": "name",
  "наименование": "name",
  "товар": "name",
  "name": "name",
  "артикул": "sku",
  "инвентарный номер": "sku",
  "sku": "sku",
  "категория": "category",
  "группа": "category",
  "подкатегория": "subcategory",
  "серийный номер": "serialNumber",
  "количество": "quantity",
  "кол-во": "quantity",
  "всего": "quantity",
  "дата создания": "createdAt",
  "дата добавления": "createdAt",
  "закупочная цена": "purchasePrice",
  "себестоимость": "purchasePrice",
  "цена аренды": "rentalPricePerDay",
  "цена за сутки": "rentalPricePerDay",
  "цена, ₸": "rentalPricePerDay",
  "цена": "rentalPricePerDay",
  "пункт проката": "branch",
  "филиал": "branch",
  "заметка": "notes",
  "примечание": "notes",
};

/** Мусорные значения категории из выгрузки — лучше пусто, чем «Категория» */
const JUNK_CATEGORIES = new Set(["категория", "группа", "без категории", "-", "—"]);

/**
 * Разбор выгрузки каталога. Формат прошлой системы:
 * `ID | Название | Артикул | Категория | Доступность | Количество | Дата создания | тарифы…`
 *
 * Тарифы приходят отдельными колонками с длительностью в заголовке — «День (1 д.)»,
 * «3 дня (3 д.)». В карточку кладём цену за сутки: берём дневной тариф, а если его
 * нет — пересчитываем ближайший по длительности. «Доступность» не импортируем: она
 * считается сама по активным арендам, из файла её брать нельзя.
 */
export async function parseInventoryFile(file: File): Promise<InventoryImportRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  if (rows.length === 0) return [];

  // Тарифные колонки ищем один раз по заголовкам первой строки
  const tariffColumns = Object.keys(rows[0])
    .map((header) => ({ header, tariff: parseTariffHeader(header) }))
    .filter((c): c is { header: string; tariff: { days: number } } => c.tariff !== null)
    .sort((a, b) => a.tariff.days - b.tariff.days);

  return rows.map((row) => {
    const item: InventoryImportRow = {};

    for (const [rawKey, value] of Object.entries(row)) {
      const key = HEADER_ALIASES[normalizeHeader(rawKey)];
      if (!key || value === "" || value === null) continue;

      switch (key) {
        case "quantity":
          item.quantity = parseNumber(value) ?? 1;
          break;
        case "purchasePrice":
        case "rentalPricePerDay":
          item[key] = parseNumber(value) ?? 0;
          break;
        case "createdAt":
          item.createdAt = parseImportDate(value);
          break;
        case "category": {
          const category = String(value).trim();
          if (category && !JUNK_CATEGORIES.has(category.toLowerCase())) item.category = category;
          break;
        }
        case "sku": {
          // «QS» без номера — это не артикул, а остаток шаблона: пусть система присвоит свой
          const sku = String(value).trim();
          if (/\d/.test(sku)) item.sku = sku;
          break;
        }
        default:
          (item as Record<string, unknown>)[key] = String(value).trim();
      }
    }

    if (item.rentalPricePerDay === undefined) {
      item.rentalPricePerDay = pricePerDayFromTariffs(row, tariffColumns);
    }

    return item;
  });
}

/** Цена за сутки из тарифных колонок: дневная как есть, остальные — делим на срок */
function pricePerDayFromTariffs(
  row: Record<string, unknown>,
  columns: { header: string; tariff: { days: number } }[]
): number {
  const filled = columns
    .map((c) => ({ days: c.tariff.days, price: parseNumber(row[c.header]) }))
    .filter((c): c is { days: number; price: number } => c.price !== undefined && c.price > 0);
  if (filled.length === 0) return 0;

  const daily = filled.find((c) => c.days === 1);
  if (daily) return daily.price;

  // Ближайший к суткам тариф пересчитываем — грубо, зато цена не теряется
  const closest = filled.reduce((best, c) => (Math.abs(c.days - 1) < Math.abs(best.days - 1) ? c : best));
  return Math.round(closest.price / closest.days);
}
