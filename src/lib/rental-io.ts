import * as XLSX from "xlsx";
import { RentalStatus } from "./types";
import { normalizeHeader, normalizePhone, parseImportDate, parseNumber } from "./import-utils";

/** Одна аренда из выгрузки — уже разобранная, но ещё не привязанная к базе */
export interface RentalImportRow {
  number: string;
  clientName: string;
  clientPhone: string;
  status: RentalStatus;
  /** Должник — это завершённая аренда с долгом, отдельного статуса у нас нет */
  paymentStatus: "paid" | "partial" | "pending" | "overdue";
  startAt?: string;
  endAt?: string;
  /** Когда инструмент фактически вернули — по нему считается пунктуальность клиента */
  returnedAt?: string;
  total: number;
  paid: number;
  /** Скидка = разница между ценой без скидки и итоговой; храним как пометку */
  discount: number;
  createdAt?: string;
  items: { name: string; sku: string }[];
}

const HEADER_ALIASES: Record<string, keyof RentalImportRow | "discountBase" | "items"> = {
  "№": "number",
  "номер": "number",
  "номер аренды": "number",
  "фио/название компании": "clientName",
  "клиент": "clientName",
  "номер телефона": "clientPhone",
  "телефон": "clientPhone",
  "контакты": "clientPhone",
  "статус": "status",
  "начало аренды": "startAt",
  "дата начала": "startAt",
  "конец аренды": "endAt",
  "дата конца": "endAt",
  "факт. конец аренды": "returnedAt",
  "фактический конец аренды": "returnedAt",
  "стоимость без скидки": "discountBase",
  "стоимость аренды": "total",
  "общая сумма": "total",
  "оплаченная сумма": "paid",
  "дата добавления": "createdAt",
  "инвентари": "items",
  "инвентарь": "items",
};

/** Статусы прошлой системы. «Должник» у нас не статус, а признак долга */
const STATUS_MAP: Record<string, { status: RentalStatus; debtor?: boolean }> = {
  "в аренде": { status: "active" },
  "выдано": { status: "active" },
  "просрочено": { status: "overdue" },
  "завершено": { status: "completed" },
  "завершена": { status: "completed" },
  "должник": { status: "completed", debtor: true },
  "отменено": { status: "cancelled" },
  "отменена": { status: "cancelled" },
  "забронировано": { status: "booked" },
  "бронь": { status: "booked" },
  "украдено": { status: "stolen" },
};

/**
 * Позиции аренды приходят одной строкой: `Название (АРТИКУЛ), Название (АРТИКУЛ)`.
 * Режем по скобкам, а не по запятым: в названиях инструментов запятые встречаются,
 * и разбиение по ним рвало бы позиции пополам.
 */
function parseItems(raw: string): { name: string; sku: string }[] {
  const items: { name: string; sku: string }[] = [];
  for (const m of raw.matchAll(/([^,()]+?)\s*\(([^)]+)\)/g)) {
    const name = m[1].trim().replace(/^[,\s]+/, "");
    const sku = m[2].trim();
    if (name) items.push({ name, sku });
  }

  // Позиции без артикула в скобках — берём как есть, чтобы состав не потерялся
  if (items.length === 0) {
    for (const part of raw.split(",")) {
      const name = part.trim();
      if (name) items.push({ name, sku: "" });
    }
  }
  return items;
}

/**
 * Разбор выгрузки аренд. Формат прошлой системы:
 * `№ | ФИО | Телефон | Статус | Начало | Факт. начало | Конец | Факт. конец |
 *  Стоимость без скидки | Стоимость аренды | Оплаченная сумма | Дата добавления | Инвентари`
 *
 * «Факт. начало» не читаем: у нас начало аренды одно — то, что в договоре.
 * А вот «Факт. конец» важен: по нему считается пунктуальность клиента в рейтинге.
 */
export async function parseRentalsFile(file: File): Promise<RentalImportRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  return rows.map((row) => {
    const out: RentalImportRow = {
      number: "",
      clientName: "",
      clientPhone: "",
      status: "completed",
      paymentStatus: "pending",
      total: 0,
      paid: 0,
      discount: 0,
      items: [],
    };
    let debtor = false;
    let base: number | undefined;

    for (const [rawKey, value] of Object.entries(row)) {
      const key = HEADER_ALIASES[normalizeHeader(rawKey)];
      if (!key || value === "" || value === null) continue;

      switch (key) {
        case "status": {
          const mapped = STATUS_MAP[String(value).trim().toLowerCase()];
          if (mapped) {
            out.status = mapped.status;
            debtor = !!mapped.debtor;
          }
          break;
        }
        case "startAt":
        case "endAt":
        case "returnedAt":
        case "createdAt":
          out[key] = parseImportDate(value);
          break;
        case "total":
        case "paid":
          out[key] = parseNumber(value) ?? 0;
          break;
        case "discountBase":
          base = parseNumber(value);
          break;
        case "clientPhone":
          out.clientPhone = normalizePhone(value);
          break;
        case "items":
          out.items = parseItems(String(value));
          break;
        default:
          (out as unknown as Record<string, unknown>)[key] = String(value).trim();
      }
    }

    if (base !== undefined && base > out.total) out.discount = base - out.total;

    // Статус оплаты выводим из сумм: «Должник» в файле — это ровно долг по закрытой аренде
    const owed = out.total - out.paid;
    out.paymentStatus = owed <= 0 && out.total > 0 ? "paid" : debtor || owed > 0 ? (out.paid > 0 ? "partial" : "pending") : "pending";
    if (debtor || (owed > 0 && (out.status === "completed" || out.status === "overdue"))) {
      out.paymentStatus = "overdue";
    }

    return out;
  });
}
