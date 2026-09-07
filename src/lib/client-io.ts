import * as XLSX from "xlsx";
import { Client } from "./types";
import { normalizeHeader, normalizePhone, parseImportDate, parseNumber } from "./import-utils";

const EXPORT_COLUMNS: { key: keyof Client; header: string }[] = [
  { key: "name", header: "ФИО/Название компании" },
  { key: "type", header: "Тип клиента" },
  { key: "phone", header: "Телефон" },
  { key: "email", header: "Email" },
  { key: "iin", header: "ИИН" },
  { key: "birthDate", header: "Дата рождения" },
  { key: "bin", header: "БИН" },
  { key: "legalAddress", header: "Юридический адрес" },
  { key: "companyDirector", header: "Руководитель компании" },
  { key: "bankAccount", header: "ИИК" },
  { key: "bank", header: "Банк" },
  { key: "bik", header: "БИК" },
  { key: "acquisitionChannel", header: "Канал привлечения" },
  { key: "discount", header: "Скидка (%)" },
  { key: "rating", header: "Рейтинг" },
  { key: "totalRentals", header: "Кол-во аренд" },
  { key: "totalSpent", header: "Сумма аренд" },
  { key: "lastRentalDate", header: "Дата последней аренды" },
];

function clientsToRows(clients: Client[]) {
  return clients.map((c) => {
    const row: Record<string, string | number> = {};
    for (const col of EXPORT_COLUMNS) {
      const v = c[col.key];
      row[col.header] = v === undefined || v === null ? "" : (v as string | number);
    }
    return row;
  });
}

export function exportClientsToExcel(clients: Client[], filename = "клиенты.xlsx") {
  const rows = clientsToRows(clients);
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Клиенты");
  XLSX.writeFile(wb, filename);
}

export function exportClientsToCSV(clients: Client[], filename = "клиенты.csv") {
  const rows = clientsToRows(clients);
  const ws = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws);
  // BOM for correct Cyrillic rendering in Excel
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const HEADER_ALIASES: Record<string, keyof Client> = {
  "фио": "name",
  "фио/название компании": "name",
  "название": "name",
  "имя": "name",
  "name": "name",
  "тип клиента": "type",
  "тип": "type",
  "type": "type",
  "телефон": "phone",
  "номер телефона": "phone",
  "phone": "phone",
  "email": "email",
  "эл. почта": "email",
  "почта": "email",
  "иин": "iin",
  "дата рождения": "birthDate",
  "бин": "bin",
  "юридический адрес": "legalAddress",
  "юр. адрес": "legalAddress",
  "адрес": "legalAddress",
  "руководитель компании": "companyDirector",
  "руководитель": "companyDirector",
  "иик": "bankAccount",
  "номер счёта": "bankAccount",
  "номер счета": "bankAccount",
  "банк": "bank",
  "бик": "bik",
  "канал привлечения": "acquisitionChannel",
  "канал": "acquisitionChannel",
  // Так называются колонки в выгрузке прошлой системы
  "контакты": "phone",
  "контакт": "phone",
  "вид": "type",
  "дата добавления клиента": "createdAt",
  "дата добавления": "createdAt",
  "заметка": "notes",
  "примечание": "notes",
  "комментарий": "notes",
  "скидка": "discount",
  "скидка (%)": "discount",
  "рейтинг": "rating",
};

/**
 * Пометки из колонки «Рейтинг» прошлой системы. Там лежат не звёзды, а статусы:
 * «Черный список» переводим во флаг, остальное сохраняем как заметку — терять
 * такие подписи нельзя, менеджеры на них опираются.
 */
function applyLegacyMark(client: Partial<Client>, raw: string) {
  const mark = raw.trim();
  if (!mark) return;
  if (/чер|чёр|black/i.test(mark)) {
    client.blacklisted = true;
    return;
  }
  client.notes = client.notes ? `${client.notes}; ${mark}` : mark;
}

/**
 * Разбор файла клиентов. Понимает и наш экспорт, и выгрузку прошлой системы:
 * `ID | ФИО/Название компании | Вид | Контакты | Дата добавления клиента | Рейтинг | …`
 *
 * Накопленные суммы («Кол-во заказов», «Сумма аренд») сознательно не читаем: они
 * считаются по реальным арендам, и подставлять их из файла — значит соврать в отчётах.
 */
export async function parseClientsFile(file: File): Promise<Partial<Client>[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  return rows.map((row) => {
    const client: Partial<Client> = {};

    for (const [rawKey, value] of Object.entries(row)) {
      const header = normalizeHeader(rawKey);
      const key = HEADER_ALIASES[header];
      if (value === "" || value === null || value === undefined) continue;

      // «Рейтинг» в выгрузке — это метка, а не число: звёзды у нас считаются сами
      if (header === "рейтинг") {
        applyLegacyMark(client, String(value));
        continue;
      }
      if (!key) continue;

      if (key === "type") {
        const v = String(value).toLowerCase();
        client.type = v.includes("юр") || v.includes("тоо") || v.includes("company") ? "company" : "individual";
      } else if (key === "phone") {
        client.phone = normalizePhone(value);
      } else if (key === "discount") {
        client.discount = parseNumber(value);
      } else if (key === "rating") {
        applyLegacyMark(client, String(value));
      } else if (key === "createdAt") {
        const iso = parseImportDate(value);
        if (iso) client.createdAt = iso;
      } else {
        (client as Record<string, unknown>)[key] = String(value).trim();
      }
    }

    return client;
  });
}
