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

/**
 * Понижение регистра с поддержкой кириллицы. Встроенная SQLite `LOWER()` знает
 * только латиницу: поиск «иванов» не находил запись «ИВАНОВ», и половина базы
 * была не найдена — при том что выглядело это как «поиск иногда не работает».
 */
db.function("rulower", { deterministic: true }, (value: unknown) =>
  typeof value === "string" ? value.toLowerCase() : value === null || value === undefined ? null : String(value).toLowerCase()
);

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

CREATE TABLE IF NOT EXISTS return_shortages (
  id TEXT PRIMARY KEY,
  rental_id TEXT NOT NULL,
  inventory_item_id TEXT,
  item_name TEXT NOT NULL,
  note TEXT,
  resolved INTEGER NOT NULL DEFAULT 0,
  resolved_at TEXT,
  resolved_by TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS rental_payments (
  id TEXT PRIMARY KEY,
  rental_id TEXT NOT NULL,
  amount REAL NOT NULL,
  method TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shop_products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sku TEXT,
  serial_number TEXT,
  category TEXT,
  price REAL NOT NULL DEFAULT 0,
  purchase_cost REAL,
  qty REAL NOT NULL DEFAULT 0,
  photo_url TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT
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
CREATE INDEX IF NOT EXISTS idx_shop_products_name ON shop_products(name);
CREATE INDEX IF NOT EXISTS idx_rental_payments_rental ON rental_payments(rental_id);
CREATE INDEX IF NOT EXISTS idx_rental_payments_created ON rental_payments(created_at);
CREATE INDEX IF NOT EXISTS idx_rental_documents_created ON rental_documents(created_at);
CREATE INDEX IF NOT EXISTS idx_return_shortages_resolved ON return_shortages(resolved);
CREATE INDEX IF NOT EXISTS idx_return_shortages_rental ON return_shortages(rental_id);

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

CREATE TABLE IF NOT EXISTS deliveries (
  id TEXT PRIMARY KEY,
  number INTEGER NOT NULL,
  rental_id TEXT,
  kind TEXT NOT NULL DEFAULT 'delivery',
  direction TEXT NOT NULL DEFAULT 'to',
  status TEXT NOT NULL DEFAULT 'new',
  courier_id TEXT,
  deliver_by TEXT,
  address_from TEXT,
  address_to TEXT,
  client_phone TEXT,
  receiver_phone TEXT,
  price REAL NOT NULL DEFAULT 0,
  comment TEXT,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_rental ON deliveries(rental_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_courier ON deliveries(courier_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_deliver_by ON deliveries(deliver_by);

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

ensureColumns("rentals", {
  paused_at: "TEXT",
  paid_at: "TEXT",
  // Момент фактического возврата — по нему считается пунктуальность клиента
  returned_at: "TEXT",
  // Товары магазина списываются со склада ровно один раз, при выдаче
  shop_written_off: "INTEGER NOT NULL DEFAULT 0",
});

ensureColumns("app_users", { is_owner: "INTEGER NOT NULL DEFAULT 0" });

// Чек оплаты показывает, кто принял деньги — раньше в платеже этого не было
ensureColumns("rental_payments", { created_by: "TEXT" });

// Журнал напоминаний: кому, о чём и когда уже написали. Без него один и тот же
// клиент получал бы одно и то же напоминание каждый день
db.exec(`
  CREATE TABLE IF NOT EXISTS reminder_log (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    target_id TEXT NOT NULL,
    phone TEXT,
    message TEXT,
    sent_at TEXT NOT NULL,
    sent_by TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_reminder_log_target ON reminder_log(kind, target_id);
`);

// Задачи, которые система ставит себе сама по данным CRM: просрочка, долг,
// некомплект. Пара «источник + объект» уникальна — иначе на каждую проверку
// заводился бы дубль той же задачи
ensureColumns("tasks", { source_kind: "TEXT", source_id: "TEXT", source_url: "TEXT" });
db.exec(
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_source ON tasks(source_kind, source_id) WHERE source_kind IS NOT NULL`
);

// «Будущий клиент» — решение менеджера, а не отсутствие даты: заявки без даты,
// заведённые до появления колонки, разом переносим туда же
{
  const has = (db.prepare(`PRAGMA table_info(leads)`).all() as { name: string }[]).some((c) => c.name === "future");
  if (!has) {
    db.exec(`ALTER TABLE leads ADD COLUMN future INTEGER NOT NULL DEFAULT 0`);
    db.exec(`UPDATE leads SET future = 1 WHERE needed_at IS NULL AND unavailable = 0`);
  }
}

ensureColumns("leads", {
  // Физлицо или компания — от этого зависит, как оформлять аренду
  client_type: "TEXT",
  // Клиент не из города: дату «когда нужен инструмент» с него не требуем
  other_city: "INTEGER NOT NULL DEFAULT 0",
  // Возражения клиента: дорого / далеко / дорогая доставка
  concerns: "TEXT",
  // Настроение клиента, 1–5 — по нему видно, чем закончится разговор
  mood: "INTEGER",
});

// Владелец — тот, кто создал систему. В базах, заведённых до появления роли,
// им становится исходный «admin», иначе самый первый администратор
{
  const hasOwner = (db.prepare(`SELECT COUNT(*) AS c FROM app_users WHERE is_owner = 1`).get() as { c: number }).c > 0;
  if (!hasOwner) {
    const first = db
      .prepare(`SELECT id FROM app_users WHERE login = 'admin' OR is_admin = 1 ORDER BY (login = 'admin') DESC, created_at LIMIT 1`)
      .get() as { id: string } | undefined;
    if (first) db.prepare(`UPDATE app_users SET is_owner = 1, is_admin = 1 WHERE id = ?`).run(first.id);
  }
}

ensureColumns("rental_documents", {
  // Документ живёт дальше печати: его подписывают, и это надо где-то отмечать
  signed: "INTEGER NOT NULL DEFAULT 0",
  signed_at: "TEXT",
  signed_by: "TEXT",
  sign_method: "TEXT",
});

ensureColumns("clients", {
  // Свободная пометка: при импорте сюда попадают метки старой системы («Умер»)
  notes: "TEXT",
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

// Сид: создать главного администратора при первом запуске.
// is_owner ставится сразу: блок миграции выше отрабатывает раньше этой вставки,
// и на пустой базе владельца там ещё не из кого выбрать — без флага никто не смог
// бы выдавать права администратора на свежей установке.
(async () => {
  const existing = db.prepare(`SELECT id FROM app_users WHERE login = 'admin'`).get();
  if (!existing) {
    const bcrypt = await import("bcryptjs");
    const hash = await bcrypt.hash("admin", 10);
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO app_users (id, login, password_hash, name, is_admin, is_owner, is_active, permissions_json, created_at)
       VALUES ('admin', 'admin', ?, 'Администратор', 1, 1, 1, '[]', ?)`
    ).run(hash, now);
    return;
  }

  // База, заведённая до появления роли: владельца назначаем существующему админу
  const hasOwner = (db.prepare(`SELECT COUNT(*) AS c FROM app_users WHERE is_owner = 1`).get() as { c: number }).c > 0;
  if (!hasOwner) db.prepare(`UPDATE app_users SET is_owner = 1, is_admin = 1 WHERE id = ?`).run((existing as { id: string }).id);
})();

export function logActivity(text: string) {
  const id = `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  db.prepare(`INSERT INTO activity_log (id, text, time) VALUES (?, ?, ?)`).run(id, text, new Date().toISOString());
}
