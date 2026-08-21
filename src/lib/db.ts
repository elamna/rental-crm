import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

// На Railway/VPS данные хранятся в /data (постоянный диск)
// Локально — в папке data/ рядом с проектом
const dataDir = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "app.db");

declare global {
  var __rentalCrmDb: Database.Database | undefined;
}

export const db = global.__rentalCrmDb ?? new Database(dbPath);
if (process.env.NODE_ENV !== "production") global.__rentalCrmDb = db;

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");

db.exec(`
CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'individual',
  phone TEXT NOT NULL,
  email TEXT,
  photo_url TEXT,
  iin TEXT,
  birth_date TEXT,
  document_number TEXT,
  document_issued_by TEXT,
  document_issued_at TEXT,
  document_expires_at TEXT,
  acquisition_channel TEXT,
  discount REAL,
  rating INTEGER,
  blacklisted INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sku TEXT,
  category TEXT,
  subcategory TEXT,
  serial_number TEXT,
  photo_url TEXT,
  purchase_cost REAL,
  rental_price REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'available',
  branch TEXT,
  mileage REAL,
  engine_hours REAL,
  last_service_at TEXT,
  next_service_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rentals (
  id TEXT PRIMARY KEY,
  number TEXT NOT NULL,
  status TEXT NOT NULL,
  payment_status TEXT NOT NULL,
  branch TEXT,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  rental_period TEXT,
  client_id TEXT NOT NULL REFERENCES clients(id),
  total REAL NOT NULL DEFAULT 0,
  paid REAL NOT NULL DEFAULT 0,
  booked_by_name TEXT,
  issued_by_name TEXT,
  comment TEXT,
  delivery INTEGER DEFAULT 0,
  auto_penalty_enabled INTEGER DEFAULT 0,
  penalty_rate_per_hour REAL DEFAULT 0,
  items_json TEXT NOT NULL DEFAULT '[]',
  deposit_json TEXT,
  penalties_json TEXT NOT NULL DEFAULT '[]',
  expenses_json TEXT NOT NULL DEFAULT '[]',
  documents_json TEXT NOT NULL DEFAULT '[]',
  notes_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS activity_log (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  time TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workshop_tickets (
  id TEXT PRIMARY KEY,
  number TEXT NOT NULL,
  status TEXT NOT NULL,
  reason TEXT NOT NULL,
  inventory_item_id TEXT NOT NULL REFERENCES inventory_items(id),
  title TEXT NOT NULL,
  description TEXT,
  lines_json TEXT NOT NULL DEFAULT '[]',
  source_rental_id TEXT REFERENCES rentals(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS document_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rental_documents (
  id TEXT PRIMARY KEY,
  rental_id TEXT NOT NULL REFERENCES rentals(id),
  template_id TEXT REFERENCES document_templates(id),
  name TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_users (
  id TEXT PRIMARY KEY,
  login TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  position TEXT,
  is_admin INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  permissions_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS company_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`);

// Сид: настройки компании по умолчанию
{
  const defaults: Record<string, string> = {
    company_name: "ИП Компания",
    company_bin: "",
    company_address: "",
    company_phone: "",
    company_email: "",
    company_bank: "",
    company_bik: "",
    company_account: "",
    company_director: "",
    company_logo_url: "",
    currency: "₸",
    city: "Атырау",
  };
  const ins = db.prepare(`INSERT OR IGNORE INTO company_settings (key, value) VALUES (?, ?)`);
  for (const [k, v] of Object.entries(defaults)) ins.run(k, v);
}

// Сид: создать главного администратора при первом запуске
(async () => {
  const existing = db.prepare(`SELECT id FROM app_users WHERE login = 'admin'`).get();
  if (!existing) {
    const bcrypt = await import("bcryptjs");
    const hash = await bcrypt.hash("admin", 10);
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO app_users (id, login, password_hash, name, is_admin, is_active, permissions_json, created_at)
       VALUES ('admin', 'admin', ?, 'Администратор', 1, 1, '[]', ?)`
    ).run(hash, now);
  }
})();

export function logActivity(text: string) {
  const id = `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  db.prepare(`INSERT INTO activity_log (id, text, time) VALUES (?, ?, ?)`).run(id, text, new Date().toISOString());
}
