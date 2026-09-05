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
  bin TEXT,
  legal_address TEXT,
  company_director TEXT,
  bank_account TEXT,
  bank TEXT,
  bik TEXT,
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

CREATE TABLE IF NOT EXISTS kits (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  photo_url TEXT,
  price REAL NOT NULL DEFAULT 0,
  lines_json TEXT NOT NULL DEFAULT '[]',
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  tariffs_json TEXT NOT NULL DEFAULT '[]',
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS inventory_checks (
  id TEXT PRIMARY KEY,
  inventory_item_id TEXT NOT NULL,
  condition TEXT NOT NULL,
  checked_by_name TEXT,
  comment TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_inventory_checks_item ON inventory_checks(inventory_item_id);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo',
  priority TEXT NOT NULL DEFAULT 'normal',
  assignee_id TEXT,
  created_by_id TEXT,
  due_at TEXT,
  done_at TEXT,
  points INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS task_viewers (
  task_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  PRIMARY KEY (task_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_done_at ON tasks(done_at);
CREATE INDEX IF NOT EXISTS idx_task_viewers_user ON task_viewers(user_id);

CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  number INTEGER NOT NULL,
  title TEXT NOT NULL,
  client_name TEXT,
  phone TEXT,
  amount REAL NOT NULL DEFAULT 0,
  manager_id TEXT,
  source TEXT,
  needed_at TEXT,
  unavailable INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',
  notes TEXT,
  closed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_needed_at ON leads(needed_at);
CREATE INDEX IF NOT EXISTS idx_leads_manager ON leads(manager_id);

CREATE TABLE IF NOT EXISTS rental_events (
  id TEXT PRIMARY KEY,
  rental_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  details TEXT,
  actor_name TEXT,
  before_json TEXT,
  reverted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rental_pauses (
  id TEXT PRIMARY KEY,
  rental_id TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  reason TEXT,
  actor_name TEXT
);

CREATE INDEX IF NOT EXISTS idx_rental_events_rental ON rental_events(rental_id);
CREATE INDEX IF NOT EXISTS idx_rental_pauses_rental ON rental_pauses(rental_id);
`);

// Миграции: дозаливаем недостающие колонки в базы, созданные более ранними версиями.
// CREATE TABLE IF NOT EXISTS не меняет структуру существующей таблицы, поэтому только так.
function ensureColumns(table: string, columns: Record<string, string>) {
  const existing = new Set((db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name));
  for (const [name, type] of Object.entries(columns)) {
    if (existing.has(name)) continue;
    try {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`);
    } catch (err) {
      // Next поднимает несколько воркеров, каждый импортирует этот модуль: колонку мог
      // добавить сосед между PRAGMA и ALTER. Любую другую ошибку пробрасываем дальше.
      if (!String((err as Error).message).includes("duplicate column name")) throw err;
    }
  }
}

ensureColumns("rentals", { paused_at: "TEXT" });

ensureColumns("clients", {
  bin: "TEXT",
  legal_address: "TEXT",
  company_director: "TEXT",
  bank_account: "TEXT",
  bank: "TEXT",
  bik: "TEXT",
});

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
