import * as XLSX from "xlsx";
import { Client } from "./types";

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
  "скидка": "discount",
  "скидка (%)": "discount",
  "рейтинг": "rating",
};

export async function parseClientsFile(file: File): Promise<Partial<Client>[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  return rows.map((row) => {
    const client: Partial<Client> = {};
    for (const [rawKey, value] of Object.entries(row)) {
      const key = HEADER_ALIASES[rawKey.trim().toLowerCase()];
      if (!key || value === "") continue;
      if (key === "type") {
        const v = String(value).toLowerCase();
        client.type = v.includes("юр") || v.includes("company") ? "company" : "individual";
      } else if (key === "discount" || key === "rating") {
        client[key] = Number(value);
      } else {
        (client as Record<string, unknown>)[key] = String(value);
      }
    }
    return client;
  });
}
