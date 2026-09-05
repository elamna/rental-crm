import { db, logActivity } from "./db";
import { Client, DocumentTemplate, InventoryCheck, InventoryItem, InventoryLine, Kit, KitLine, Rental, RentalDocument, RentalEvent, RentalPause, RentalStatus, Lead, Service, ServiceTariff, Task, TaskKpiRow, TaskPriority, TaskStatus, WorkshopLine, WorkshopTicket } from "./types";

function newId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ---------- Clients ----------

interface ClientRow {
  id: string;
  name: string;
  type: string;
  phone: string;
  email: string | null;
  photo_url: string | null;
  iin: string | null;
  birth_date: string | null;
  document_number: string | null;
  document_issued_by: string | null;
  document_issued_at: string | null;
  document_expires_at: string | null;
  bin: string | null;
  legal_address: string | null;
  company_director: string | null;
  bank_account: string | null;
  bank: string | null;
  bik: string | null;
  acquisition_channel: string | null;
  discount: number | null;
  rating: number | null;
  blacklisted: number;
  created_at: string;
}

function clientRowToDomain(row: ClientRow, rentalRows: { total: number; paid: number; status: string; start_at: string }[]): Client {
  const totalRentals = rentalRows.length;
  const totalSpent = rentalRows.reduce((s, r) => s + r.paid, 0);
  const repeatRentals = Math.max(0, totalRentals - 1);
  const overdueCount = rentalRows.filter((r) => r.status === "overdue").length;
  const lastRentalDate = rentalRows.length ? rentalRows.map((r) => r.start_at).sort().slice(-1)[0]?.slice(0, 10) : undefined;

  return {
    id: row.id,
    name: row.name,
    type: row.type as Client["type"],
    phone: row.phone,
    email: row.email ?? undefined,
    photoUrl: row.photo_url ?? undefined,
    iin: row.iin ?? undefined,
    birthDate: row.birth_date ?? undefined,
    documentNumber: row.document_number ?? undefined,
    documentIssuedBy: row.document_issued_by ?? undefined,
    documentIssuedAt: row.document_issued_at ?? undefined,
    documentExpiresAt: row.document_expires_at ?? undefined,
    bin: row.bin ?? undefined,
    legalAddress: row.legal_address ?? undefined,
    companyDirector: row.company_director ?? undefined,
    bankAccount: row.bank_account ?? undefined,
    bank: row.bank ?? undefined,
    bik: row.bik ?? undefined,
    acquisitionChannel: row.acquisition_channel ?? undefined,
    discount: row.discount ?? undefined,
    rating: row.rating ?? undefined,
    blacklisted: !!row.blacklisted,
    createdAt: row.created_at,
    totalRentals,
    totalSpent,
    repeatRentals,
    overdueCount,
    lastRentalDate,
  };
}

function rentalSummariesForClient(clientId: string) {
  return db.prepare(`SELECT total, paid, status, start_at FROM rentals WHERE client_id = ?`).all(clientId) as {
    total: number;
    paid: number;
    status: string;
    start_at: string;
  }[];
}

export function listClients(): Client[] {
  const rows = db.prepare(`SELECT * FROM clients ORDER BY created_at DESC`).all() as ClientRow[];
  return rows.map((row) => clientRowToDomain(row, rentalSummariesForClient(row.id)));
}

export function getClient(id: string): Client | null {
  const row = db.prepare(`SELECT * FROM clients WHERE id = ?`).get(id) as ClientRow | undefined;
  if (!row) return null;
  return clientRowToDomain(row, rentalSummariesForClient(row.id));
}

/**
 * Поиск клиента по телефону без учёта форматирования: +7 707 370-51-31 и
 * 87073705131 — один и тот же человек. Тянем только id и телефон, сравниваем в JS:
 * в SQLite нет регулярных выражений, а цепочка REPLACE всё равно не пошла бы по индексу.
 */
export function findClientByPhone(phone: string): Client | null {
  const digits = phone.replace(/D/g, "").slice(-10);
  if (digits.length < 10) return null;
  const rows = db.prepare(`SELECT id, phone FROM clients`).all() as { id: string; phone: string }[];
  const hit = rows.find((r) => r.phone.replace(/D/g, "").slice(-10) === digits);
  return hit ? getClient(hit.id) : null;
}

export function createClient(input: Partial<Client>): Client {
  const id = newId("cl");
  const createdAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO clients (id, name, type, phone, email, photo_url, iin, birth_date, document_number, document_issued_by, document_issued_at, document_expires_at, bin, legal_address, company_director, bank_account, bank, bik, acquisition_channel, discount, rating, blacklisted, created_at)
     VALUES (@id, @name, @type, @phone, @email, @photoUrl, @iin, @birthDate, @documentNumber, @documentIssuedBy, @documentIssuedAt, @documentExpiresAt, @bin, @legalAddress, @companyDirector, @bankAccount, @bank, @bik, @acquisitionChannel, @discount, @rating, @blacklisted, @createdAt)`
  ).run({
    id,
    name: input.name ?? "",
    type: input.type ?? "individual",
    phone: input.phone ?? "",
    email: input.email ?? null,
    photoUrl: input.photoUrl ?? null,
    iin: input.iin ?? null,
    birthDate: input.birthDate ?? null,
    documentNumber: input.documentNumber ?? null,
    documentIssuedBy: input.documentIssuedBy ?? null,
    documentIssuedAt: input.documentIssuedAt ?? null,
    documentExpiresAt: input.documentExpiresAt ?? null,
    bin: input.bin ?? null,
    legalAddress: input.legalAddress ?? null,
    companyDirector: input.companyDirector ?? null,
    bankAccount: input.bankAccount ?? null,
    bank: input.bank ?? null,
    bik: input.bik ?? null,
    acquisitionChannel: input.acquisitionChannel ?? null,
    discount: input.discount ?? null,
    rating: input.rating ?? null,
    blacklisted: input.blacklisted ? 1 : 0,
    createdAt,
  });
  logActivity(`Добавлен клиент «${input.name}»`);
  return getClient(id)!;
}

export function updateClient(id: string, patch: Partial<Client>) {
  const existing = db.prepare(`SELECT * FROM clients WHERE id = ?`).get(id) as ClientRow | undefined;
  if (!existing) return null;
  db.prepare(
    `UPDATE clients SET name=@name, type=@type, phone=@phone, email=@email, photo_url=@photo_url, iin=@iin, birth_date=@birth_date,
     document_number=@document_number, document_issued_by=@document_issued_by, document_issued_at=@document_issued_at, document_expires_at=@document_expires_at,
     bin=@bin, legal_address=@legal_address, company_director=@company_director, bank_account=@bank_account, bank=@bank, bik=@bik,
     acquisition_channel=@acquisition_channel, discount=@discount, rating=@rating, blacklisted=@blacklisted WHERE id=@id`
  ).run({
    id,
    name: patch.name ?? existing.name,
    type: patch.type ?? existing.type,
    phone: patch.phone ?? existing.phone,
    email: patch.email ?? existing.email,
    photo_url: patch.photoUrl ?? existing.photo_url,
    iin: patch.iin ?? existing.iin,
    birth_date: patch.birthDate ?? existing.birth_date,
    document_number: patch.documentNumber ?? existing.document_number,
    document_issued_by: patch.documentIssuedBy ?? existing.document_issued_by,
    document_issued_at: patch.documentIssuedAt ?? existing.document_issued_at,
    document_expires_at: patch.documentExpiresAt ?? existing.document_expires_at,
    bin: patch.bin ?? existing.bin,
    legal_address: patch.legalAddress ?? existing.legal_address,
    company_director: patch.companyDirector ?? existing.company_director,
    bank_account: patch.bankAccount ?? existing.bank_account,
    bank: patch.bank ?? existing.bank,
    bik: patch.bik ?? existing.bik,
    acquisition_channel: patch.acquisitionChannel ?? existing.acquisition_channel,
    discount: patch.discount ?? existing.discount,
    rating: patch.rating ?? existing.rating,
    blacklisted: patch.blacklisted !== undefined ? (patch.blacklisted ? 1 : 0) : existing.blacklisted,
  });
  return getClient(id);
}

export function deleteClient(id: string) {
  const c = getClient(id);
  db.prepare(`DELETE FROM clients WHERE id = ?`).run(id);
  if (c) logActivity(`Удалён клиент «${c.name}»`);
}

export function importClients(rows: Partial<Client>[]): { added: number; skipped: number } {
  const existingPhones = new Set((db.prepare(`SELECT phone FROM clients`).all() as { phone: string }[]).map((r) => r.phone.replace(/\D/g, "")));
  let added = 0;
  let skipped = 0;
  for (const row of rows) {
    const phone = (row.phone || "").toString().replace(/\D/g, "");
    if (!row.name || !phone || existingPhones.has(phone)) {
      skipped++;
      continue;
    }
    existingPhones.add(phone);
    createClient(row);
    added++;
  }
  if (added) logActivity(`Импортировано клиентов: ${added}`);
  return { added, skipped };
}

// ---------- Inventory ----------

interface InventoryRow {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  subcategory: string | null;
  serial_number: string | null;
  photo_url: string | null;
  purchase_cost: number | null;
  rental_price: number;
  status: string;
  branch: string | null;
  notes: string | null;
  created_at: string;
}

function inventoryRowToDomain(row: InventoryRow): InventoryItem {
  return {
    id: row.id,
    name: row.name,
    sku: row.sku ?? "",
    category: row.category ?? "",
    subcategory: row.subcategory ?? undefined,
    serialNumber: row.serial_number ?? undefined,
    photoUrl: row.photo_url ?? undefined,
    purchasePrice: row.purchase_cost ?? undefined,
    rentalPricePerDay: row.rental_price,
    status: row.status as InventoryItem["status"],
    branch: row.branch ?? "",
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
  };
}

export function listInventory(): InventoryItem[] {
  const rows = db.prepare(`SELECT * FROM inventory_items ORDER BY created_at DESC`).all() as InventoryRow[];
  return rows.map(inventoryRowToDomain);
}

export function getInventoryItem(id: string): InventoryItem | null {
  const row = db.prepare(`SELECT * FROM inventory_items WHERE id = ?`).get(id) as InventoryRow | undefined;
  return row ? inventoryRowToDomain(row) : null;
}

export function createInventoryItem(input: Partial<InventoryItem>): InventoryItem {
  const id = newId("inv");
  const createdAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO inventory_items (id, name, sku, category, subcategory, serial_number, photo_url, purchase_cost, rental_price, status, branch, notes, created_at)
     VALUES (@id, @name, @sku, @category, @subcategory, @serialNumber, @photoUrl, @purchaseCost, @rentalPrice, @status, @branch, @notes, @createdAt)`
  ).run({
    id,
    name: input.name ?? "",
    sku: input.sku?.trim() || nextSku(),
    category: input.category ?? null,
    subcategory: input.subcategory ?? null,
    serialNumber: input.serialNumber ?? null,
    photoUrl: input.photoUrl ?? null,
    purchaseCost: input.purchasePrice ?? null,
    rentalPrice: input.rentalPricePerDay ?? 0,
    status: input.status ?? "available",
    branch: input.branch ?? null,
    notes: input.notes ?? null,
    createdAt,
  });
  logActivity(`Добавлен инструмент «${input.name}» в каталог`);
  return getInventoryItem(id)!;
}

export function updateInventoryItem(id: string, patch: Partial<InventoryItem>) {
  const existing = db.prepare(`SELECT * FROM inventory_items WHERE id = ?`).get(id) as InventoryRow | undefined;
  if (!existing) return null;
  db.prepare(
    `UPDATE inventory_items SET name=@name, sku=@sku, category=@category, subcategory=@subcategory, serial_number=@serial_number,
     photo_url=@photo_url, purchase_cost=@purchase_cost, rental_price=@rental_price, status=@status, branch=@branch, notes=@notes WHERE id=@id`
  ).run({
    id,
    name: patch.name ?? existing.name,
    sku: patch.sku ?? existing.sku,
    category: patch.category ?? existing.category,
    subcategory: patch.subcategory ?? existing.subcategory,
    serial_number: patch.serialNumber ?? existing.serial_number,
    photo_url: patch.photoUrl ?? existing.photo_url,
    purchase_cost: patch.purchasePrice ?? existing.purchase_cost,
    rental_price: patch.rentalPricePerDay ?? existing.rental_price,
    status: patch.status ?? existing.status,
    branch: patch.branch ?? existing.branch,
    notes: patch.notes ?? existing.notes,
  });
  return getInventoryItem(id);
}

export function deleteInventoryItem(id: string) {
  db.prepare(`DELETE FROM inventory_items WHERE id = ?`).run(id);
}

/** Следующий свободный артикул вида QS.0123 (нумерация продолжает уже существующие). */
export function nextSku(prefix = "QS"): string {
  const rows = db.prepare(`SELECT sku FROM inventory_items WHERE sku LIKE ?`).all(`${prefix}.%`) as { sku: string | null }[];
  let max = 0;
  for (const r of rows) {
    const m = /\.(\d+)/.exec(r.sku ?? "");
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}.${String(max + 1).padStart(4, "0")}`;
}

/** Создаёт сразу несколько одинаковых единиц продукта, каждой — свой артикул. */
export function createInventoryItems(input: Partial<InventoryItem>, quantity: number): InventoryItem[] {
  const created: InventoryItem[] = [];
  const count = Math.max(1, Math.floor(quantity || 1));
  for (let i = 0; i < count; i++) {
    // Свой артикул на каждую единицу: заданный вручную подходит только одной из них
    created.push(createInventoryItem({ ...input, sku: count === 1 ? input.sku : undefined }));
  }
  return created;
}

// ---------- Каталог: комплекты ----------

interface KitRow {
  id: string;
  name: string;
  category: string | null;
  photo_url: string | null;
  price: number;
  lines_json: string;
  notes: string | null;
  created_at: string;
}

function kitRowToDomain(row: KitRow): Kit {
  return {
    id: row.id,
    name: row.name,
    category: row.category ?? "",
    photoUrl: row.photo_url ?? undefined,
    price: row.price,
    lines: JSON.parse(row.lines_json || "[]") as KitLine[],
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
  };
}

export function listKits(): Kit[] {
  const rows = db.prepare(`SELECT * FROM kits ORDER BY created_at DESC`).all() as KitRow[];
  return rows.map(kitRowToDomain);
}

export function getKit(id: string): Kit | null {
  const row = db.prepare(`SELECT * FROM kits WHERE id = ?`).get(id) as KitRow | undefined;
  return row ? kitRowToDomain(row) : null;
}

export function createKit(input: Partial<Kit>): Kit {
  const id = newId("kit");
  const createdAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO kits (id, name, category, photo_url, price, lines_json, notes, created_at)
     VALUES (@id, @name, @category, @photoUrl, @price, @linesJson, @notes, @createdAt)`
  ).run({
    id,
    name: input.name ?? "",
    category: input.category ?? null,
    photoUrl: input.photoUrl ?? null,
    price: input.price ?? 0,
    linesJson: JSON.stringify(input.lines ?? []),
    notes: input.notes ?? null,
    createdAt,
  });
  logActivity(`Добавлен комплект «${input.name}»`);
  return getKit(id)!;
}

export function updateKit(id: string, patch: Partial<Kit>) {
  const existing = getKit(id);
  if (!existing) return null;
  const merged = { ...existing, ...patch };
  db.prepare(
    `UPDATE kits SET name=@name, category=@category, photo_url=@photoUrl, price=@price, lines_json=@linesJson, notes=@notes WHERE id=@id`
  ).run({
    id,
    name: merged.name,
    category: merged.category || null,
    photoUrl: merged.photoUrl ?? null,
    price: merged.price,
    linesJson: JSON.stringify(merged.lines ?? []),
    notes: merged.notes ?? null,
  });
  return getKit(id);
}

export function deleteKit(id: string) {
  db.prepare(`DELETE FROM kits WHERE id = ?`).run(id);
}

// ---------- Каталог: услуги ----------

interface ServiceRow {
  id: string;
  name: string;
  category: string | null;
  tariffs_json: string;
  notes: string | null;
  created_at: string;
}

function serviceRowToDomain(row: ServiceRow): Service {
  return {
    id: row.id,
    name: row.name,
    category: row.category ?? undefined,
    tariffs: JSON.parse(row.tariffs_json || "[]") as ServiceTariff[],
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
  };
}

export function listServices(): Service[] {
  const rows = db.prepare(`SELECT * FROM services ORDER BY created_at DESC`).all() as ServiceRow[];
  return rows.map(serviceRowToDomain);
}

export function getService(id: string): Service | null {
  const row = db.prepare(`SELECT * FROM services WHERE id = ?`).get(id) as ServiceRow | undefined;
  return row ? serviceRowToDomain(row) : null;
}

export function createService(input: Partial<Service>): Service {
  const id = newId("srv");
  const createdAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO services (id, name, category, tariffs_json, notes, created_at)
     VALUES (@id, @name, @category, @tariffsJson, @notes, @createdAt)`
  ).run({
    id,
    name: input.name ?? "",
    category: input.category ?? null,
    tariffsJson: JSON.stringify(input.tariffs ?? []),
    notes: input.notes ?? null,
    createdAt,
  });
  logActivity(`Добавлена услуга «${input.name}»`);
  return getService(id)!;
}

export function updateService(id: string, patch: Partial<Service>) {
  const existing = getService(id);
  if (!existing) return null;
  const merged = { ...existing, ...patch };
  db.prepare(`UPDATE services SET name=@name, category=@category, tariffs_json=@tariffsJson, notes=@notes WHERE id=@id`).run({
    id,
    name: merged.name,
    category: merged.category ?? null,
    tariffsJson: JSON.stringify(merged.tariffs ?? []),
    notes: merged.notes ?? null,
  });
  return getService(id);
}

export function deleteService(id: string) {
  db.prepare(`DELETE FROM services WHERE id = ?`).run(id);
}

// ---------- Инвентаризация ----------

interface InventoryCheckRow {
  id: string;
  inventory_item_id: string;
  condition: string;
  checked_by_name: string | null;
  comment: string | null;
  created_at: string;
}

function checkRowToDomain(row: InventoryCheckRow): InventoryCheck {
  return {
    id: row.id,
    inventoryItemId: row.inventory_item_id,
    condition: row.condition as InventoryCheck["condition"],
    checkedByName: row.checked_by_name ?? "",
    comment: row.comment ?? undefined,
    createdAt: row.created_at,
  };
}

export function listInventoryChecks(): InventoryCheck[] {
  const rows = db.prepare(`SELECT * FROM inventory_checks ORDER BY created_at DESC`).all() as InventoryCheckRow[];
  return rows.map(checkRowToDomain);
}

export function createInventoryCheck(input: Partial<InventoryCheck>): InventoryCheck {
  const id = newId("chk");
  const createdAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO inventory_checks (id, inventory_item_id, condition, checked_by_name, comment, created_at)
     VALUES (@id, @inventoryItemId, @condition, @checkedByName, @comment, @createdAt)`
  ).run({
    id,
    inventoryItemId: input.inventoryItemId ?? "",
    condition: input.condition ?? "ok",
    checkedByName: input.checkedByName ?? null,
    comment: input.comment ?? null,
    createdAt,
  });

  // «Сломан» — если единица свободна, отправляем её в ремонт (в аренде/украдена не трогаем)
  if (input.condition === "broken" && input.inventoryItemId) {
    const current = db.prepare(`SELECT status, name FROM inventory_items WHERE id = ?`).get(input.inventoryItemId) as
      | { status: string; name: string }
      | undefined;
    if (current && current.status === "available") {
      db.prepare(`UPDATE inventory_items SET status = 'repair' WHERE id = ?`).run(input.inventoryItemId);
    }
    if (current) logActivity(`Инвентаризация: «${current.name}» отмечен как сломан`);
  }

  const row = db.prepare(`SELECT * FROM inventory_checks WHERE id = ?`).get(id) as InventoryCheckRow;
  return checkRowToDomain(row);
}

// ---------- Rentals ----------

interface RentalRow {
  id: string;
  number: string;
  status: string;
  payment_status: string;
  branch: string | null;
  start_at: string;
  end_at: string;
  rental_period: string | null;
  client_id: string;
  total: number;
  paid: number;
  booked_by_name: string | null;
  issued_by_name: string | null;
  comment: string | null;
  delivery: number;
  auto_penalty_enabled: number;
  penalty_rate_per_hour: number | null;
  paused_at: string | null;
  items_json: string;
  deposit_json: string | null;
  penalties_json: string;
  expenses_json: string;
  documents_json: string;
  notes_json: string;
  created_at: string;
  updated_at: string;
}

function rentalRowToDomain(row: RentalRow): Rental | null {
  const client = getClient(row.client_id);
  if (!client) return null;
  return {
    id: row.id,
    status: row.status as RentalStatus,
    paymentStatus: row.payment_status as Rental["paymentStatus"],
    branch: row.branch ?? "",
    // У аренд, созданных до сквозной нумерации, номер лежит с решёткой — убираем,
    // чтобы «№» ставился только в интерфейсе
    number: row.number.replace(/^№/, ""),
    startDate: (row.start_at ?? "").slice(0, 10),
    endDate: (row.end_at ?? "").slice(0, 10),
    startAt: row.start_at,
    endAt: row.end_at,
    rentalPeriod: (row.rental_period ?? undefined) as Rental["rentalPeriod"],
    client,
    total: row.total,
    paid: row.paid,
    items: JSON.parse(row.items_json || "[]") as InventoryLine[],
    bookedBy: { id: "me", name: row.booked_by_name ?? "—", initials: "?", role: "" },
    issuedBy: row.issued_by_name ? { id: "me", name: row.issued_by_name, initials: "?", role: "" } : undefined,
    comment: row.comment ?? undefined,
    delivery: !!row.delivery,
    deposit: row.deposit_json ? JSON.parse(row.deposit_json) : undefined,
    penalties: JSON.parse(row.penalties_json || "[]"),
    expenses: JSON.parse(row.expenses_json || "[]"),
    documents: JSON.parse(row.documents_json || "[]"),
    notes: JSON.parse(row.notes_json || "[]"),
    pausedAt: row.paused_at ?? undefined,
    autoPenaltyEnabled: !!row.auto_penalty_enabled,
    penaltyRatePerHour: row.penalty_rate_per_hour ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listRentals(): Rental[] {
  const rows = db.prepare(`SELECT * FROM rentals ORDER BY created_at DESC`).all() as RentalRow[];
  return rows.map(rentalRowToDomain).filter((r): r is Rental => r !== null);
}

export function getRental(id: string): Rental | null {
  const row = db.prepare(`SELECT * FROM rentals WHERE id = ?`).get(id) as RentalRow | undefined;
  return row ? rentalRowToDomain(row) : null;
}

function toRentalRow(r: Rental, createdAt: string, updatedAt: string) {
  return {
    id: r.id,
    number: r.number,
    status: r.status,
    payment_status: r.paymentStatus,
    branch: r.branch,
    start_at: r.startAt ?? new Date().toISOString(),
    end_at: r.endAt ?? new Date().toISOString(),
    rental_period: r.rentalPeriod ?? null,
    client_id: r.client.id,
    total: r.total,
    paid: r.paid,
    booked_by_name: r.bookedBy?.name ?? null,
    issued_by_name: r.issuedBy?.name ?? null,
    comment: r.comment ?? null,
    delivery: r.delivery ? 1 : 0,
    auto_penalty_enabled: r.autoPenaltyEnabled ? 1 : 0,
    penalty_rate_per_hour: r.penaltyRatePerHour ?? null,
    items_json: JSON.stringify(r.items ?? []),
    deposit_json: r.deposit ? JSON.stringify(r.deposit) : null,
    penalties_json: JSON.stringify(r.penalties ?? []),
    expenses_json: JSON.stringify(r.expenses ?? []),
    documents_json: JSON.stringify(r.documents ?? []),
    notes_json: JSON.stringify(r.notes ?? []),
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

function applyInventoryLock(items: InventoryLine[], status: "rented" | "available") {
  for (const item of items) {
    if (item.inventoryItemId) {
      if (status === "available") {
        // Не затираем статус, если товар уже отмечен как требующий обслуживания/ремонта/списан
        // (это делается вручную при возврате товара, до вызова completed).
        const current = db.prepare(`SELECT status FROM inventory_items WHERE id = ?`).get(item.inventoryItemId) as
          | { status: string }
          | undefined;
        if (current && current.status !== "rented") continue;
      }
      db.prepare(`UPDATE inventory_items SET status = ? WHERE id = ?`).run(status, item.inventoryItemId);
    }
  }
}

/**
 * Следующий номер аренды — сквозной счётчик по порядку создания.
 * Счётчик лежит отдельной строкой в company_settings и только растёт:
 * MAX(number) не годится, потому что старые аренды пронумерованы обрывком
 * времени (№806978), а COUNT(*) дал бы дубли после удаления аренды.
 */
const nextRentalNumber = db.transaction((): string => {
  const row = db.prepare(`SELECT value FROM company_settings WHERE key = 'rental_counter'`).get() as
    | { value: string }
    | undefined;

  // Первый запуск после перехода на сквозную нумерацию — продолжаем с числа уже созданных
  const next = row ? Number(row.value) + 1 : ((db.prepare(`SELECT COUNT(*) AS c FROM rentals`).get() as { c: number }).c + 1);

  db.prepare(
    `INSERT INTO company_settings (key, value) VALUES ('rental_counter', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(String(next));

  return String(next);
});

export function createRental(input: Rental): Rental {
  const now = new Date().toISOString();
  // Номер присваивает сервер: на клиенте два менеджера могли бы получить одинаковый
  input = { ...input, number: nextRentalNumber() };
  db.prepare(
    `INSERT INTO rentals (id, number, status, payment_status, branch, start_at, end_at, rental_period, client_id, total, paid,
      booked_by_name, issued_by_name, comment, delivery, auto_penalty_enabled, penalty_rate_per_hour,
      items_json, deposit_json, penalties_json, expenses_json, documents_json, notes_json, created_at, updated_at)
     VALUES (@id, @number, @status, @payment_status, @branch, @start_at, @end_at, @rental_period, @client_id, @total, @paid,
      @booked_by_name, @issued_by_name, @comment, @delivery, @auto_penalty_enabled, @penalty_rate_per_hour,
      @items_json, @deposit_json, @penalties_json, @expenses_json, @documents_json, @notes_json, @created_at, @updated_at)`
  ).run(toRentalRow(input, now, now));

  applyInventoryLock(input.items, "rented");
  logRentalEvent({
    rentalId: input.id,
    type: "created",
    title: "Создал",
    details: input.items.map((i) => i.name).join(", ") || undefined,
    actorName: input.bookedBy?.name,
  });
  logActivity(`Оформлена аренда №${input.number}`);
  return getRental(input.id)!;
}

export function updateRental(id: string, patch: Partial<Rental>, options: { silent?: boolean; actorName?: string } = {}) {
  const existingRow = db.prepare(`SELECT * FROM rentals WHERE id = ?`).get(id) as RentalRow | undefined;
  if (!existingRow) return null;
  const existing = rentalRowToDomain(existingRow)!;
  // Номер аренды не перезаписываем пустым: его присвоил сервер при создании
  const merged: Rental = { ...existing, ...patch, number: patch.number || existing.number, client: patch.client ?? existing.client };
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE rentals SET number=@number, status=@status, payment_status=@payment_status, branch=@branch, start_at=@start_at, end_at=@end_at,
     rental_period=@rental_period, client_id=@client_id, total=@total, paid=@paid, booked_by_name=@booked_by_name, issued_by_name=@issued_by_name,
     comment=@comment, delivery=@delivery, auto_penalty_enabled=@auto_penalty_enabled, penalty_rate_per_hour=@penalty_rate_per_hour,
     items_json=@items_json, deposit_json=@deposit_json, penalties_json=@penalties_json, expenses_json=@expenses_json,
     documents_json=@documents_json, notes_json=@notes_json, updated_at=@updated_at WHERE id=@id`
  ).run(toRentalRow(merged, existingRow.created_at, now));

  if (merged.status === "completed" || merged.status === "cancelled") {
    applyInventoryLock(merged.items, "available");
  }

  const updated = getRental(id);
  // silent — при откате: там своё событие, иначе история зациклится
  if (updated && !options.silent) diffRentalToEvents(existing, updated, options.actorName);
  return updated;
}

// ---------- История аренды и паузы ----------

interface RentalEventRow {
  id: string;
  rental_id: string;
  type: string;
  title: string;
  details: string | null;
  actor_name: string | null;
  before_json: string | null;
  reverted: number;
  created_at: string;
}

export function logRentalEvent(input: {
  rentalId: string;
  type: RentalEvent["type"];
  title: string;
  details?: string;
  actorName?: string;
  before?: Record<string, unknown>;
}) {
  db.prepare(
    `INSERT INTO rental_events (id, rental_id, type, title, details, actor_name, before_json, reverted, created_at)
     VALUES (@id, @rentalId, @type, @title, @details, @actorName, @beforeJson, 0, @createdAt)`
  ).run({
    id: newId("rev"),
    rentalId: input.rentalId,
    type: input.type,
    title: input.title,
    details: input.details ?? null,
    actorName: input.actorName ?? null,
    beforeJson: input.before ? JSON.stringify(input.before) : null,
    createdAt: new Date().toISOString(),
  });
}

export function listRentalEvents(rentalId: string): RentalEvent[] {
  const rows = db
    .prepare(`SELECT * FROM rental_events WHERE rental_id = ? ORDER BY created_at`)
    .all(rentalId) as RentalEventRow[];
  return rows.map((r) => ({
    id: r.id,
    rentalId: r.rental_id,
    type: r.type as RentalEvent["type"],
    title: r.title,
    details: r.details ?? undefined,
    actorName: r.actor_name ?? undefined,
    before: r.before_json ? (JSON.parse(r.before_json) as Record<string, unknown>) : undefined,
    reverted: !!r.reverted,
    createdAt: r.created_at,
  }));
}

const STATUS_EVENT_TITLES: Record<string, string> = {
  request: "Вернул в черновик",
  booked: "Бронировал",
  active: "Выдал инвентарь",
  completed: "Завершил аренду",
  overdue: "Просрочена",
  stolen: "Отметил кражу",
  cancelled: "Отменил аренду",
};

/**
 * Сравнивает аренду до и после изменения и пишет в историю только то,
 * что реально поменялось. Один разбор в updateRental вместо десятка
 * ручных вызовов по всему интерфейсу — иначе часть действий неизбежно забыли бы.
 */
function diffRentalToEvents(before: Rental, after: Rental, actorName?: string) {
  const rentalId = after.id;

  if (before.status !== after.status) {
    logRentalEvent({
      rentalId,
      type: "status",
      title: STATUS_EVENT_TITLES[after.status] ?? `Статус: ${after.status}`,
      details: after.items.map((i) => `${i.name}${i.sku ? ` (${i.sku})` : ""}`).join(", ") || undefined,
      actorName,
      before: { status: before.status },
    });
  }

  if (before.paid !== after.paid) {
    const delta = after.paid - before.paid;
    logRentalEvent({
      rentalId,
      type: "payment",
      title: delta > 0 ? "Принял оплату" : "Вернул средства",
      details: `${formatAmount(Math.abs(delta))} · было ${formatAmount(before.paid)}, стало ${formatAmount(after.paid)}`,
      actorName,
      before: { paid: before.paid, paymentStatus: before.paymentStatus },
    });
  }

  if (before.total !== after.total) {
    logRentalEvent({
      rentalId,
      type: "total",
      title: after.total < before.total ? "Применил скидку" : "Изменил сумму",
      details: `было ${formatAmount(before.total)}, стало ${formatAmount(after.total)}`,
      actorName,
      before: { total: before.total },
    });
  }

  const beforeItems = before.items.map((i) => i.id).join("|");
  const afterItems = after.items.map((i) => i.id).join("|");
  if (beforeItems !== afterItems) {
    logRentalEvent({
      rentalId,
      type: "items",
      title: after.items.length > before.items.length ? "Добавил позиции" : "Убрал позиции",
      details: after.items.map((i) => i.name).join(", ") || "состав пуст",
      actorName,
      before: { items: before.items, total: before.total },
    });
  }

  if (before.startAt !== after.startAt || before.endAt !== after.endAt) {
    logRentalEvent({
      rentalId,
      type: "dates",
      title: "Изменил даты",
      details: `${formatDateShort(after.startAt)} — ${formatDateShort(after.endAt)}`,
      actorName,
      before: { startAt: before.startAt, endAt: before.endAt },
    });
  }
}

function formatAmount(v: number) {
  return `${new Intl.NumberFormat("ru-RU").format(v)} ₸`;
}

function formatDateShort(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/**
 * Откат ошибочного действия: возвращаем полям значения из before.
 * Само событие помечается откаченным, а факт отката тоже попадает в историю —
 * ничего из журнала не исчезает.
 */
export function revertRentalEvent(eventId: string, actorName?: string): Rental | null {
  const row = db.prepare(`SELECT * FROM rental_events WHERE id = ?`).get(eventId) as RentalEventRow | undefined;
  if (!row || row.reverted || !row.before_json) return null;

  const before = JSON.parse(row.before_json) as Partial<Rental>;
  const updated = updateRental(row.rental_id, before, { silent: true });
  if (!updated) return null;

  db.prepare(`UPDATE rental_events SET reverted = 1 WHERE id = ?`).run(eventId);
  logRentalEvent({
    rentalId: row.rental_id,
    type: "revert",
    title: "Отменил действие",
    details: `«${row.title}» от ${formatDateShort(row.created_at)}`,
    actorName,
  });
  return updated;
}

// ---------- Паузы ----------

interface RentalPauseRow {
  id: string;
  rental_id: string;
  started_at: string;
  ended_at: string | null;
  reason: string | null;
  actor_name: string | null;
}

function pauseRowToDomain(r: RentalPauseRow): RentalPause {
  const end = r.ended_at ? new Date(r.ended_at).getTime() : Date.now();
  const hours = Math.max(0, (end - new Date(r.started_at).getTime()) / 3600000);
  return {
    id: r.id,
    rentalId: r.rental_id,
    startedAt: r.started_at,
    endedAt: r.ended_at ?? undefined,
    reason: r.reason ?? undefined,
    actorName: r.actor_name ?? undefined,
    hours: Math.round(hours * 10) / 10,
  };
}

export function listRentalPauses(rentalId: string): RentalPause[] {
  const rows = db
    .prepare(`SELECT * FROM rental_pauses WHERE rental_id = ? ORDER BY started_at DESC`)
    .all(rentalId) as RentalPauseRow[];
  return rows.map(pauseRowToDomain);
}

export function pauseRental(rentalId: string, actorName?: string, reason?: string): Rental | null {
  const rental = getRental(rentalId);
  if (!rental || rental.pausedAt) return rental;

  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO rental_pauses (id, rental_id, started_at, ended_at, reason, actor_name)
     VALUES (?, ?, ?, NULL, ?, ?)`
  ).run(newId("pau"), rentalId, now, reason ?? null, actorName ?? null);
  db.prepare(`UPDATE rentals SET paused_at = ?, updated_at = ? WHERE id = ?`).run(now, now, rentalId);

  logRentalEvent({ rentalId, type: "paused", title: "Поставил на паузу", details: reason, actorName });
  return getRental(rentalId);
}

/**
 * Снятие с паузы сдвигает дату окончания на длительность простоя:
 * иначе клиент, у которого работы встали не по его вине, получил бы просрочку.
 */
export function resumeRental(rentalId: string, actorName?: string): Rental | null {
  const rental = getRental(rentalId);
  if (!rental || !rental.pausedAt) return rental;

  const now = new Date();
  const pausedMs = now.getTime() - new Date(rental.pausedAt).getTime();

  db.prepare(`UPDATE rental_pauses SET ended_at = ? WHERE rental_id = ? AND ended_at IS NULL`).run(now.toISOString(), rentalId);

  const newEnd = rental.endAt ? new Date(new Date(rental.endAt).getTime() + pausedMs).toISOString() : null;
  db.prepare(`UPDATE rentals SET paused_at = NULL, end_at = COALESCE(?, end_at), updated_at = ? WHERE id = ?`).run(
    newEnd,
    now.toISOString(),
    rentalId
  );

  const hours = Math.round((pausedMs / 3600000) * 10) / 10;
  logRentalEvent({
    rentalId,
    type: "resumed",
    title: "Снял с паузы",
    details: `Простой ${hours} ч, дата возврата сдвинута`,
    actorName,
  });
  return getRental(rentalId);
}

/** Полное удаление аренды: снимаем блокировку инвентаря и чистим связанные записи */
export function deleteRental(id: string) {
  const rental = getRental(id);
  if (!rental) return;

  applyInventoryLock(rental.items, "available");
  db.prepare(`DELETE FROM rental_events WHERE rental_id = ?`).run(id);
  db.prepare(`DELETE FROM rental_pauses WHERE rental_id = ?`).run(id);
  db.prepare(`DELETE FROM rental_documents WHERE rental_id = ?`).run(id);
  db.prepare(`DELETE FROM rentals WHERE id = ?`).run(id);
  logActivity(`Удалена аренда №${rental.number}`);
}

// ---------- Activity ----------

export function listActivity(limit = 50) {
  return db.prepare(`SELECT id, text, time FROM activity_log ORDER BY time DESC LIMIT ?`).all(limit) as {
    id: string;
    text: string;
    time: string;
  }[];
}

// ---------- Overdue + automatic hourly penalties (used by the background job) ----------

export function applyOverdueAndPenalties(): { markedOverdue: number; penaltiesAdded: number } {
  const now = Date.now();
  // Аренда на паузе не просрочивается: часы простоя не по вине клиента
  const active = db.prepare(`SELECT * FROM rentals WHERE status IN ('active','booked','overdue') AND paused_at IS NULL`).all() as RentalRow[];
  let markedOverdue = 0;
  let penaltiesAdded = 0;

  for (const row of active) {
    const start = new Date(row.start_at).getTime();
    const end = new Date(row.end_at).getTime();
    if (now <= end) continue;

    const hoursLate = Math.floor((now - end) / 3600000);
    let penalties = JSON.parse(row.penalties_json || "[]") as { reason: string; amount: number }[];

    // Помечаем как просроченную
    if (row.status !== "overdue") {
      db.prepare(`UPDATE rentals SET status = 'overdue', updated_at = ? WHERE id = ?`).run(new Date().toISOString(), row.id);
      markedOverdue++;
    }

    // Пересчёт total по фактическим дням (с начала аренды до сейчас)
    // Только для аренд с посуточным периодом (не почасовые штрафы)
    if (!row.auto_penalty_enabled || !row.penalty_rate_per_hour) {
      try {
        const items = JSON.parse(row.items_json || "[]") as { pricePerDay: number; qty: number; category?: string }[];
        const products = items.filter((i) => i.category !== "service");
        if (products.length > 0) {
          // Фактические дни = от начала аренды до сейчас (минимум 1)
          const actualDays = Math.max(1, Math.ceil((now - start) / 86400000));
          // Оригинальные дни = от начала до конца по договору
          const bookedDays = Math.max(1, Math.ceil((end - start) / 86400000));

          if (actualDays > bookedDays) {
            // Считаем новый total: товары × фактические дни + услуги (фикс)
            const services = items.filter((i) => i.category === "service");
            const productTotal = products.reduce((s, i) => s + i.pricePerDay * i.qty * actualDays, 0);
            const serviceTotal = services.reduce((s, i) => s + i.pricePerDay * i.qty, 0);
            const newTotal = productTotal + serviceTotal;

            if (newTotal > row.total) {
              db.prepare(`UPDATE rentals SET total = ?, updated_at = ? WHERE id = ?`).run(
                newTotal,
                new Date().toISOString(),
                row.id
              );
            }
          }
        }
      } catch { /* ignore parse errors */ }
    }

    // Почасовые штрафы (если включены)
    if (row.auto_penalty_enabled && row.penalty_rate_per_hour && hoursLate > 0) {
      const alreadyChargedHours = penalties.filter((p) => p.reason.startsWith("Авто-штраф")).length;
      const hoursToCharge = hoursLate - alreadyChargedHours;
      if (hoursToCharge > 0) {
        for (let h = alreadyChargedHours + 1; h <= hoursLate; h++) {
          penalties = [...penalties, { reason: `Авто-штраф за просрочку (час ${h})`, amount: row.penalty_rate_per_hour }];
          penaltiesAdded++;
        }
        const addedTotal = hoursToCharge * row.penalty_rate_per_hour;
        db.prepare(`UPDATE rentals SET penalties_json = ?, total = total + ?, updated_at = ? WHERE id = ?`).run(
          JSON.stringify(penalties),
          addedTotal,
          new Date().toISOString(),
          row.id
        );
      }
    }
  }

  return { markedOverdue, penaltiesAdded };
}

// ---------- Workshop ----------

interface WorkshopTicketRow {
  id: string;
  number: string;
  status: string;
  reason: string;
  inventory_item_id: string;
  title: string;
  description: string | null;
  lines_json: string;
  source_rental_id: string | null;
  created_at: string;
  updated_at: string;
}

function workshopTotal(lines: WorkshopLine[]) {
  return lines.reduce((sum, line) => sum + line.qty * line.price, 0);
}

function workshopRowToDomain(row: WorkshopTicketRow): WorkshopTicket {
  const lines = JSON.parse(row.lines_json || "[]") as WorkshopLine[];
  return {
    id: row.id,
    number: row.number,
    status: row.status as WorkshopTicket["status"],
    reason: row.reason as WorkshopTicket["reason"],
    inventoryItemId: row.inventory_item_id,
    inventoryItem: getInventoryItem(row.inventory_item_id) ?? undefined,
    title: row.title,
    description: row.description ?? undefined,
    lines,
    total: workshopTotal(lines),
    sourceRentalId: row.source_rental_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listWorkshopTickets(): WorkshopTicket[] {
  const rows = db.prepare(`SELECT * FROM workshop_tickets ORDER BY created_at DESC`).all() as WorkshopTicketRow[];
  return rows.map(workshopRowToDomain);
}

export function getWorkshopTicket(id: string): WorkshopTicket | null {
  const row = db.prepare(`SELECT * FROM workshop_tickets WHERE id = ?`).get(id) as WorkshopTicketRow | undefined;
  return row ? workshopRowToDomain(row) : null;
}

export function createWorkshopTicket(input: Partial<WorkshopTicket>): WorkshopTicket {
  const id = input.id ?? newId("ws");
  const now = new Date().toISOString();
  const item = input.inventoryItemId ? getInventoryItem(input.inventoryItemId) : null;
  const reason = input.reason ?? "repair";
  const status = input.status ?? "new";
  const lines = input.lines ?? [];
  db.prepare(
    `INSERT INTO workshop_tickets (id, number, status, reason, inventory_item_id, title, description, lines_json, source_rental_id, created_at, updated_at)
     VALUES (@id, @number, @status, @reason, @inventory_item_id, @title, @description, @lines_json, @source_rental_id, @created_at, @updated_at)`
  ).run({
    id,
    number: input.number ?? `WS-${Date.now().toString().slice(-6)}`,
    status,
    reason,
    inventory_item_id: input.inventoryItemId,
    title: input.title ?? (reason === "maintenance" ? "Профилактика оборудования" : "Ремонт оборудования"),
    description: input.description ?? null,
    lines_json: JSON.stringify(lines),
    source_rental_id: input.sourceRentalId ?? null,
    created_at: now,
    updated_at: now,
  });

  if (input.inventoryItemId && (reason === "maintenance" || reason === "repair")) {
    db.prepare(`UPDATE inventory_items SET status = ? WHERE id = ?`).run(reason, input.inventoryItemId);
  }
  logActivity(`Создана заявка мастерской ${input.number ?? id}${item ? `: ${item.name}` : ""}`);
  return getWorkshopTicket(id)!;
}

export function updateWorkshopTicket(id: string, patch: Partial<WorkshopTicket>) {
  const existingRow = db.prepare(`SELECT * FROM workshop_tickets WHERE id = ?`).get(id) as WorkshopTicketRow | undefined;
  if (!existingRow) return null;
  const existing = workshopRowToDomain(existingRow);
  const merged: WorkshopTicket = { ...existing, ...patch, lines: patch.lines ?? existing.lines };
  const now = new Date().toISOString();

  db.prepare(
    `UPDATE workshop_tickets SET status=@status, reason=@reason, inventory_item_id=@inventory_item_id, title=@title,
     description=@description, lines_json=@lines_json, source_rental_id=@source_rental_id, updated_at=@updated_at WHERE id=@id`
  ).run({
    id,
    status: merged.status,
    reason: merged.reason,
    inventory_item_id: merged.inventoryItemId,
    title: merged.title,
    description: merged.description ?? null,
    lines_json: JSON.stringify(merged.lines ?? []),
    source_rental_id: merged.sourceRentalId ?? null,
    updated_at: now,
  });

  if (merged.status === "done") {
    db.prepare(`UPDATE inventory_items SET status = 'available' WHERE id = ?`).run(merged.inventoryItemId);
  } else if (merged.status !== "archived") {
    db.prepare(`UPDATE inventory_items SET status = ? WHERE id = ?`).run(merged.reason, merged.inventoryItemId);
  }

  return getWorkshopTicket(id);
}

// ---------- Фоновый планировщик ----------
// Запускается один раз за время жизни процесса Node (при первом обращении к любому
// API-роуту, который импортирует этот модуль) и затем проверяет просрочки раз в час,
// пока запущен `npm run dev` / `npm start`. Если процесс не работает постоянно
// (например, serverless-хостинг), дёрните GET /api/cron вручную или через внешний
// планировщик (Windows Task Scheduler, cron и т.п.).
declare global {
  var __penaltySchedulerStarted: boolean | undefined;
}

if (!global.__penaltySchedulerStarted) {
  global.__penaltySchedulerStarted = true;
  const HOUR = 60 * 60 * 1000;

  const runSweep = () => {
    try {
      const result = applyOverdueAndPenalties();
      if (result.markedOverdue || result.penaltiesAdded) {
        console.log(`[penalty-scheduler] Просрочено: ${result.markedOverdue}, начислено штрафов: ${result.penaltiesAdded}`);
      }
    } catch (err) {
      console.error("[penalty-scheduler] Ошибка при проверке просрочек:", err);
    }
  };

  setTimeout(runSweep, 10_000);
  setInterval(runSweep, HOUR);
  console.log("[penalty-scheduler] Фоновая проверка просрочек запущена (раз в час)");
}

// ---------- Шаблоны документов ----------

export function listDocumentTemplates(): DocumentTemplate[] {
  return (db.prepare(`SELECT * FROM document_templates ORDER BY name`).all() as {
    id: string; name: string; body: string; created_at: string; updated_at: string;
  }[]).map((r) => ({ id: r.id, name: r.name, body: r.body, createdAt: r.created_at, updatedAt: r.updated_at }));
}

export function getDocumentTemplate(id: string): DocumentTemplate | null {
  const r = db.prepare(`SELECT * FROM document_templates WHERE id = ?`).get(id) as {
    id: string; name: string; body: string; created_at: string; updated_at: string;
  } | undefined;
  if (!r) return null;
  return { id: r.id, name: r.name, body: r.body, createdAt: r.created_at, updatedAt: r.updated_at };
}

export function createDocumentTemplate(input: { name: string; body: string }): DocumentTemplate {
  const id = newId("tpl");
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO document_templates (id, name, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`).run(id, input.name, input.body, now, now);
  return getDocumentTemplate(id)!;
}

export function updateDocumentTemplate(id: string, patch: Partial<{ name: string; body: string }>): DocumentTemplate | null {
  const existing = getDocumentTemplate(id);
  if (!existing) return null;
  const now = new Date().toISOString();
  db.prepare(`UPDATE document_templates SET name = ?, body = ?, updated_at = ? WHERE id = ?`).run(
    patch.name ?? existing.name, patch.body ?? existing.body, now, id
  );
  return getDocumentTemplate(id);
}

export function deleteDocumentTemplate(id: string) {
  db.prepare(`DELETE FROM document_templates WHERE id = ?`).run(id);
}

// ---------- Документы аренды ----------

export function listRentalDocuments(rentalId: string): RentalDocument[] {
  return (db.prepare(`SELECT * FROM rental_documents WHERE rental_id = ? ORDER BY created_at DESC`).all(rentalId) as {
    id: string; rental_id: string; template_id: string | null; name: string; body: string; created_at: string;
  }[]).map((r) => ({
    id: r.id, rentalId: r.rental_id, templateId: r.template_id ?? undefined,
    name: r.name, body: r.body, createdAt: r.created_at,
  }));
}

export function createRentalDocument(input: { rentalId: string; templateId?: string; name: string; body: string }): RentalDocument {
  const id = newId("doc");
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO rental_documents (id, rental_id, template_id, name, body, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(id, input.rentalId, input.templateId ?? null, input.name, input.body, now);
  return { id, rentalId: input.rentalId, templateId: input.templateId, name: input.name, body: input.body, createdAt: now };
}

export function deleteRentalDocument(id: string) {
  db.prepare(`DELETE FROM rental_documents WHERE id = ?`).run(id);
}

// Подстановка переменных шаблона
export function renderTemplate(template: string, rental: Rental): string {
  const client = rental.client;
  const now = new Date();

  // Настройки компании
  const settings = getCompanySettings();

  // Функция для перевода числа в текст (рублей/тенге)
  function numToText(n: number): string {
    const units = ["", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять",
      "десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать", "пятнадцать",
      "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать"];
    const tens = ["", "", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят", "восемьдесят", "девяносто"];
    const hundreds = ["", "сто", "двести", "триста", "четыреста", "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот"];
    if (n === 0) return "ноль";
    if (n < 0) return "минус " + numToText(-n);
    let result = "";
    const mil = Math.floor(n / 1_000_000);
    const tho = Math.floor((n % 1_000_000) / 1000);
    const rem = Math.floor(n % 1000);
    if (mil > 0) result += numToText(mil) + " миллион(ов) ";
    if (tho > 0) result += numToText(tho) + " тысяч(и) ";
    if (rem >= 100) { result += hundreds[Math.floor(rem / 100)] + " "; }
    const r2 = rem % 100;
    if (r2 >= 20) { result += tens[Math.floor(r2 / 10)] + " " + units[r2 % 10] + " "; }
    else if (r2 > 0) { result += units[r2] + " "; }
    return result.trim() + " тенге";
  }

  function fmt(n: number) { return n.toLocaleString("ru-RU") + " ₸"; }
  function fmtT(n: number) { return numToText(Math.round(n)); }

  // Даты
  const startD = rental.startAt ? new Date(rental.startAt) : null;
  const endD = rental.endAt ? new Date(rental.endAt) : null;
  const startDate = startD ? startD.toLocaleDateString("ru-RU") : "";
  const startTime = startD ? startD.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : "";
  const startDatetime = startD ? startD.toLocaleString("ru-RU") : "";
  const endDate = endD ? endD.toLocaleDateString("ru-RU") : "";
  const endTime = endD ? endD.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : "";
  const endDatetime = endD ? endD.toLocaleString("ru-RU") : "";

  // Длительность
  const durationDays = startD && endD
    ? Math.max(1, Math.ceil((endD.getTime() - startD.getTime()) / 86_400_000))
    : 0;

  // Суммы
  const inventoryTotal = rental.items.filter((i) => i.category !== "service").reduce((s, i) => s + i.pricePerDay * i.qty * durationDays, 0);
  const servicesTotal = rental.items.filter((i) => i.category === "service").reduce((s, i) => s + i.pricePerDay * i.qty, 0);
  const penaltyTotal = (rental.penalties ?? []).reduce((s: number, p: { amount: number }) => s + p.amount, 0);
  const unpaid = Math.max(0, rental.total - rental.paid);
  const deposit = (rental.deposit as { amount?: number } | undefined)?.amount ?? 0;
  const dailyRate = durationDays > 0 ? Math.round(rental.total / durationDays) : 0;

  // Тип клиента
  const clientTypeLabel = client.type === "company" ? "Юридическое лицо" : "Физическое лицо";

  // Таблица товаров
  const itemRows = rental.items.map((i, idx) => `<tr>
    <td style="border:1px solid #ccc;padding:4px 8px;text-align:center">${idx + 1}</td>
    <td style="border:1px solid #ccc;padding:4px 8px">${i.name}</td>
    <td style="border:1px solid #ccc;padding:4px 8px;text-align:center">${i.qty}</td>
    <td style="border:1px solid #ccc;padding:4px 8px;text-align:right">${fmt(i.pricePerDay)}/сут</td>
    <td style="border:1px solid #ccc;padding:4px 8px;text-align:right">${fmt(i.pricePerDay * i.qty * (i.category !== "service" ? durationDays : 1))}</td>
  </tr>`).join("");

  const itemsTable = `<table style="border-collapse:collapse;width:100%;font-size:12px">
    <thead><tr>
      <th style="border:1px solid #ccc;padding:4px 8px;background:#f5f5f5">№</th>
      <th style="border:1px solid #ccc;padding:4px 8px;background:#f5f5f5;text-align:left">Наименование</th>
      <th style="border:1px solid #ccc;padding:4px 8px;background:#f5f5f5">Кол-во</th>
      <th style="border:1px solid #ccc;padding:4px 8px;background:#f5f5f5">Цена</th>
      <th style="border:1px solid #ccc;padding:4px 8px;background:#f5f5f5">Сумма</th>
    </tr></thead>
    <tbody>${itemRows}</tbody>
    <tfoot><tr>
      <td colspan="4" style="border:1px solid #ccc;padding:4px 8px;text-align:right;font-weight:bold">ИТОГО:</td>
      <td style="border:1px solid #ccc;padding:4px 8px;text-align:right;font-weight:bold">${fmt(rental.total)}</td>
    </tr></tfoot>
  </table>`;

  const vars: Record<string, string> = {
    // Компания
    "{{company_name}}": settings.company_name,
    "{{company_bin}}": settings.company_bin,
    "{{company_address}}": settings.company_address,
    "{{company_phone}}": settings.company_phone,
    "{{company_email}}": settings.company_email,
    "{{company_bank}}": settings.company_bank,
    "{{company_bik}}": settings.company_bik,
    "{{company_account}}": settings.company_account,
    "{{company_director}}": settings.company_director,
    "{{city}}": settings.city,

    // Общее
    "{{id}}": rental.id,
    "{{manager_name}}": rental.bookedBy?.name ?? "",
    "{{date}}": now.toLocaleDateString("ru-RU"),
    "{{day}}": String(now.getDate()),
    "{{month}}": now.toLocaleDateString("ru-RU", { month: "long" }),
    "{{year}}": String(now.getFullYear()),
    "{{time}}": now.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
    "{{datetime}}": now.toLocaleString("ru-RU"),

    // Аренда
    "{{rental_number}}": rental.number,
    "{{rental_uid}}": rental.id,
    "{{start_datetime}}": startDatetime,
    "{{start_date}}": startDate,
    "{{start_time}}": startTime,
    "{{actual_start}}": startDatetime,
    "{{end_datetime}}": endDatetime,
    "{{end_date}}": endDate,
    "{{end_time}}": endTime,
    "{{actual_end}}": endDatetime,
    "{{duration}}": durationDays ? `${durationDays} сут.` : "",
    "{{total_no_discount}}": fmt(rental.total),
    "{{total_no_discount_text}}": fmtT(rental.total),
    "{{total}}": fmt(rental.total),
    "{{total_text}}": fmtT(rental.total),
    "{{inventory_total}}": fmt(inventoryTotal),
    "{{inventory_total_text}}": fmtT(inventoryTotal),
    "{{inventory_purchase_total}}": fmt(inventoryTotal),
    "{{inventory_purchase_total_text}}": fmtT(inventoryTotal),
    "{{services_total}}": fmt(servicesTotal),
    "{{services_total_text}}": fmtT(servicesTotal),
    "{{delivery_total}}": "0 ₸",
    "{{delivery_total_text}}": "ноль тенге",
    "{{daily_rate}}": fmt(dailyRate),
    "{{daily_rate_text}}": fmtT(dailyRate),
    "{{deposit}}": fmt(deposit),
    "{{deposit_text}}": fmtT(deposit),
    "{{paid}}": fmt(rental.paid),
    "{{paid_text}}": fmtT(rental.paid),
    "{{unpaid}}": fmt(unpaid),
    "{{unpaid_text}}": fmtT(unpaid),
    "{{discount_total}}": "0 ₸",
    "{{discount_total_text}}": "ноль тенге",
    "{{inventory_discount}}": "0 ₸",
    "{{inventory_discount_text}}": "ноль тенге",
    "{{services_discount}}": "0 ₸",
    "{{services_discount_text}}": "ноль тенге",
    "{{penalty_total}}": fmt(penaltyTotal),
    "{{penalty_total_text}}": fmtT(penaltyTotal),
    "{{created_by}}": rental.bookedBy?.name ?? "",
    "{{created_at}}": rental.createdAt ? new Date(rental.createdAt).toLocaleString("ru-RU") : "",
    "{{booked_at}}": rental.createdAt ? new Date(rental.createdAt).toLocaleDateString("ru-RU") : "",
    "{{products_count}}": String(rental.items.filter((i) => i.category !== "service").length),
    "{{services_count}}": String(rental.items.filter((i) => i.category === "service").length),
    "{{all_inventory_total}}": fmt(inventoryTotal),
    "{{all_inventory_total_text}}": fmtT(inventoryTotal),
    "{{items_table}}": itemsTable,
    "{{branch}}": rental.branch ?? "",
    "{{manager}}": rental.bookedBy?.name ?? "",

    // Клиент
    "{{client_uid}}": client.id,
    "{{client_name}}": client.name,
    "{{client_phone}}": client.phone,
    "{{client_email}}": client.email ?? "",
    "{{client_discount}}": client.discount ? `${client.discount}%` : "",
    "{{client_type}}": clientTypeLabel,
    "{{contract_number}}": "",
    "{{contract_date}}": "",
    "{{client_iin}}": client.iin ?? "",
    "{{client_document_number}}": client.documentNumber ?? "",
    "{{client_document_issued_at}}": client.documentIssuedAt ?? "",
    "{{client_document_expires_at}}": client.documentExpiresAt ?? "",
    "{{client_birth_date}}": client.birthDate ?? "",
    "{{client_document_issued_by}}": client.documentIssuedBy ?? "",
    "{{client_bin}}": client.bin ?? client.iin ?? "",
    "{{client_address}}": client.legalAddress ?? "",
    "{{client_director}}": client.companyDirector || client.name,
    "{{client_account}}": client.bankAccount ?? "",
    "{{client_bik}}": client.bik ?? "",
    "{{client_bank}}": client.bank ?? "",

    // Продукты (первый товар для одиночных переменных)
    "{{product_index}}": rental.items[0] ? "1" : "",
    "{{product_uid}}": rental.items[0]?.inventoryItemId ?? "",
    "{{product_name}}": rental.items[0]?.name ?? "",
    "{{product_sku}}": "",
    "{{product_category}}": rental.items[0]?.category ?? "",
    "{{product_qty}}": rental.items[0] ? String(rental.items[0].qty) : "",
    "{{product_total}}": rental.items[0] ? fmt(rental.items[0].pricePerDay * rental.items[0].qty * durationDays) : "",
    "{{product_total_text}}": rental.items[0] ? fmtT(rental.items[0].pricePerDay * rental.items[0].qty * durationDays) : "",
    "{{product_total_discounted}}": rental.items[0] ? fmt(rental.items[0].pricePerDay * rental.items[0].qty * durationDays) : "",
    "{{product_total_discounted_text}}": rental.items[0] ? fmtT(rental.items[0].pricePerDay * rental.items[0].qty * durationDays) : "",
    "{{product_price}}": rental.items[0] ? fmt(rental.items[0].pricePerDay) : "",
    "{{product_price_text}}": rental.items[0] ? fmtT(rental.items[0].pricePerDay) : "",
    "{{product_discount}}": "0 ₸",
    "{{product_discount_text}}": "ноль тенге",
    "{{product_penalty}}": "0 ₸",
    "{{product_penalty_text}}": "ноль тенге",
    "{{product_purchase_price}}": rental.items[0] ? fmt(rental.items[0].pricePerDay) : "",
    "{{product_purchase_price_text}}": rental.items[0] ? fmtT(rental.items[0].pricePerDay) : "",
    "{{product_market_price}}": rental.items[0] ? fmt(rental.items[0].pricePerDay) : "",
    "{{product_market_price_text}}": rental.items[0] ? fmtT(rental.items[0].pricePerDay) : "",
  };

  let result = template;
  for (const [key, val] of Object.entries(vars)) {
    result = result.split(key).join(val);
  }
  return result;
}


// ---------- Воронка: заявки ----------

interface LeadRow {
  id: string;
  number: number;
  title: string;
  client_name: string | null;
  phone: string | null;
  amount: number;
  manager_id: string | null;
  source: string | null;
  needed_at: string | null;
  unavailable: number;
  status: string;
  notes: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  manager_name?: string | null;
}

function leadRowToDomain(row: LeadRow): Lead {
  return {
    id: row.id,
    number: row.number,
    title: row.title,
    clientName: row.client_name ?? undefined,
    phone: row.phone ?? undefined,
    amount: row.amount,
    managerId: row.manager_id ?? undefined,
    managerName: row.manager_name ?? undefined,
    source: row.source ?? undefined,
    neededAt: row.needed_at ?? undefined,
    unavailable: !!row.unavailable,
    status: row.status as Lead["status"],
    notes: row.notes ?? undefined,
    closedAt: row.closed_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const LEAD_SELECT = `
  SELECT l.*, u.name AS manager_name
  FROM leads l
  LEFT JOIN app_users u ON u.id = l.manager_id
`;

export interface LeadFilter {
  /** open — доска; won/lost — архив закрытых */
  status?: Lead["status"];
  managerId?: string;
  source?: string;
  /** Диапазон по дате, когда инструмент нужен клиенту */
  from?: string;
  to?: string;
  search?: string;
  limit?: number;
}

/**
 * Доска отдаёт только открытые заявки. Закрытые запрашиваются отдельно —
 * иначе через полгода в браузер уезжали бы тысячи мёртвых карточек.
 */
export function listLeads(filter: LeadFilter = {}): Lead[] {
  const where: string[] = [];
  const params: Record<string, unknown> = { limit: filter.limit ?? 500 };

  where.push("l.status = @status");
  params.status = filter.status ?? "open";

  if (filter.managerId) {
    where.push("l.manager_id = @managerId");
    params.managerId = filter.managerId;
  }
  if (filter.source) {
    where.push("l.source = @source");
    params.source = filter.source;
  }
  if (filter.from) {
    where.push("l.needed_at >= @from");
    params.from = filter.from;
  }
  if (filter.to) {
    where.push("l.needed_at <= @to");
    params.to = filter.to;
  }
  if (filter.search) {
    where.push("(LOWER(l.title) LIKE @q OR LOWER(COALESCE(l.client_name, '')) LIKE @q OR COALESCE(l.phone, '') LIKE @q OR CAST(l.number AS TEXT) LIKE @q)");
    params.q = `%${filter.search.toLowerCase()}%`;
  }

  const rows = db
    .prepare(`${LEAD_SELECT} WHERE ${where.join(" AND ")} ORDER BY COALESCE(l.needed_at, l.created_at), l.number DESC LIMIT @limit`)
    .all(params) as LeadRow[];

  return rows.map(leadRowToDomain);
}

export function getLead(id: string): Lead | null {
  const row = db.prepare(`${LEAD_SELECT} WHERE l.id = ?`).get(id) as LeadRow | undefined;
  return row ? leadRowToDomain(row) : null;
}

function nextLeadNumber(): number {
  const row = db.prepare(`SELECT COALESCE(MAX(number), 0) AS n FROM leads`).get() as { n: number };
  return row.n + 1;
}

export function createLead(input: Partial<Lead>): Lead {
  const id = newId("lead");
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO leads (id, number, title, client_name, phone, amount, manager_id, source, needed_at, unavailable, status, notes, closed_at, created_at, updated_at)
     VALUES (@id, @number, @title, @clientName, @phone, @amount, @managerId, @source, @neededAt, @unavailable, @status, @notes, NULL, @createdAt, @updatedAt)`
  ).run({
    id,
    number: nextLeadNumber(),
    title: input.title ?? "",
    clientName: input.clientName ?? null,
    phone: input.phone ?? null,
    amount: input.amount ?? 0,
    managerId: input.managerId ?? null,
    source: input.source ?? null,
    neededAt: input.neededAt ?? null,
    unavailable: input.unavailable ? 1 : 0,
    status: input.status ?? "open",
    notes: input.notes ?? null,
    createdAt: now,
    updatedAt: now,
  });
  logActivity(`Создана заявка «${input.title}»`);
  return getLead(id)!;
}

export function updateLead(id: string, patch: Partial<Lead>): Lead | null {
  const existing = getLead(id);
  if (!existing) return null;
  const now = new Date().toISOString();
  const status = patch.status ?? existing.status;

  db.prepare(
    `UPDATE leads SET title=@title, client_name=@clientName, phone=@phone, amount=@amount, manager_id=@managerId,
     source=@source, needed_at=@neededAt, unavailable=@unavailable, status=@status, notes=@notes,
     closed_at=@closedAt, updated_at=@updatedAt WHERE id=@id`
  ).run({
    id,
    title: patch.title ?? existing.title,
    clientName: patch.clientName !== undefined ? patch.clientName || null : existing.clientName ?? null,
    phone: patch.phone !== undefined ? patch.phone || null : existing.phone ?? null,
    amount: patch.amount ?? existing.amount,
    managerId: patch.managerId !== undefined ? patch.managerId || null : existing.managerId ?? null,
    source: patch.source !== undefined ? patch.source || null : existing.source ?? null,
    neededAt: patch.neededAt !== undefined ? patch.neededAt || null : existing.neededAt ?? null,
    unavailable: (patch.unavailable ?? existing.unavailable) ? 1 : 0,
    status,
    notes: patch.notes !== undefined ? patch.notes || null : existing.notes ?? null,
    // Момент закрытия ставится один раз, при возврате на доску сбрасывается
    closedAt: status === "open" ? null : existing.closedAt ?? now,
    updatedAt: now,
  });
  return getLead(id);
}

export function deleteLead(id: string) {
  db.prepare(`DELETE FROM leads WHERE id = ?`).run(id);
}

/** Итоги для шапки доски — считаются в SQL, а не перебором карточек */
export function leadTotals(filter: LeadFilter = {}): { count: number; amount: number } {
  const status = filter.status ?? "open";
  const row = db
    .prepare(`SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0) AS amount FROM leads WHERE status = ?`)
    .get(status) as { count: number; amount: number };
  return row;
}

// ---------- Темп: задачи сотрудников ----------

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assignee_id: string | null;
  created_by_id: string | null;
  due_at: string | null;
  done_at: string | null;
  points: number;
  created_at: string;
  updated_at: string;
  assignee_name?: string | null;
  created_by_name?: string | null;
}

function taskRowToDomain(row: TaskRow, viewers: string[]): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    status: row.status as TaskStatus,
    priority: row.priority as TaskPriority,
    assigneeId: row.assignee_id ?? undefined,
    assigneeName: row.assignee_name ?? undefined,
    createdById: row.created_by_id ?? undefined,
    createdByName: row.created_by_name ?? undefined,
    dueAt: row.due_at ?? undefined,
    doneAt: row.done_at ?? undefined,
    points: row.points,
    visibleTo: viewers,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Зрители сразу для пачки задач — иначе получился бы запрос на каждую карточку */
function viewersFor(taskIds: string[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  if (taskIds.length === 0) return map;
  const placeholders = taskIds.map(() => "?").join(",");
  const rows = db
    .prepare(`SELECT task_id, user_id FROM task_viewers WHERE task_id IN (${placeholders})`)
    .all(...taskIds) as { task_id: string; user_id: string }[];
  for (const r of rows) {
    const list = map.get(r.task_id) ?? [];
    list.push(r.user_id);
    map.set(r.task_id, list);
  }
  return map;
}

const TASK_SELECT = `
  SELECT t.*, a.name AS assignee_name, c.name AS created_by_name
  FROM tasks t
  LEFT JOIN app_users a ON a.id = t.assignee_id
  LEFT JOIN app_users c ON c.id = t.created_by_id
`;

const TASK_ORDER = `
  ORDER BY
    CASE t.status WHEN 'todo' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'review' THEN 2 WHEN 'done' THEN 3 ELSE 4 END,
    CASE t.priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END,
    COALESCE(t.due_at, t.created_at)
`;

/**
 * Задачи, которые пользователю разрешено видеть.
 * Фильтр стоит в SQL, а не на клиенте: рядовой сотрудник не должен получать
 * чужие задачи даже в сетевом ответе.
 */
export function listTasks(userId: string, canManageAll: boolean, limit = 300): Task[] {
  const rows = canManageAll
    ? (db.prepare(`${TASK_SELECT} ${TASK_ORDER} LIMIT ?`).all(limit) as TaskRow[])
    : (db
        .prepare(
          `${TASK_SELECT}
           WHERE t.assignee_id = @uid
              OR t.created_by_id = @uid
              OR EXISTS (SELECT 1 FROM task_viewers v WHERE v.task_id = t.id AND v.user_id = @uid)
           ${TASK_ORDER} LIMIT @limit`
        )
        .all({ uid: userId, limit }) as TaskRow[]);

  const viewers = viewersFor(rows.map((r) => r.id));
  return rows.map((r) => taskRowToDomain(r, viewers.get(r.id) ?? []));
}

export function getTask(id: string): Task | null {
  const row = db.prepare(`${TASK_SELECT} WHERE t.id = ?`).get(id) as TaskRow | undefined;
  if (!row) return null;
  return taskRowToDomain(row, viewersFor([id]).get(id) ?? []);
}

/** Может ли пользователь видеть конкретную задачу */
export function canSeeTask(task: Task, userId: string, canManageAll: boolean) {
  return canManageAll || task.assigneeId === userId || task.createdById === userId || task.visibleTo.includes(userId);
}

function replaceViewers(taskId: string, viewers: string[]) {
  db.prepare(`DELETE FROM task_viewers WHERE task_id = ?`).run(taskId);
  if (viewers.length === 0) return;
  const ins = db.prepare(`INSERT OR IGNORE INTO task_viewers (task_id, user_id) VALUES (?, ?)`);
  const many = db.transaction((ids: string[]) => ids.forEach((uid) => ins.run(taskId, uid)));
  many(viewers);
}

export function createTask(input: Partial<Task>, createdById: string): Task {
  const id = newId("task");
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO tasks (id, title, description, status, priority, assignee_id, created_by_id, due_at, done_at, points, created_at, updated_at)
     VALUES (@id, @title, @description, @status, @priority, @assigneeId, @createdById, @dueAt, @doneAt, @points, @createdAt, @updatedAt)`
  ).run({
    id,
    title: input.title ?? "",
    description: input.description ?? null,
    status: input.status ?? "todo",
    priority: input.priority ?? "normal",
    assigneeId: input.assigneeId ?? null,
    createdById,
    dueAt: input.dueAt ?? null,
    doneAt: input.status === "done" ? now : null,
    points: input.points ?? 1,
    createdAt: now,
    updatedAt: now,
  });
  replaceViewers(id, input.visibleTo ?? []);
  logActivity(`Поставлена задача «${input.title}»`);
  return getTask(id)!;
}

export function updateTask(id: string, patch: Partial<Task>): Task | null {
  const existing = getTask(id);
  if (!existing) return null;
  const now = new Date().toISOString();
  const status = patch.status ?? existing.status;

  // Отметка времени выполнения ставится один раз — по ней считается KPI
  let doneAt = existing.doneAt ?? null;
  if (status === "done" && !doneAt) doneAt = now;
  if (status !== "done") doneAt = null;

  db.prepare(
    `UPDATE tasks SET title=@title, description=@description, status=@status, priority=@priority,
     assignee_id=@assigneeId, due_at=@dueAt, done_at=@doneAt, points=@points, updated_at=@updatedAt WHERE id=@id`
  ).run({
    id,
    title: patch.title ?? existing.title,
    description: patch.description ?? existing.description ?? null,
    status,
    priority: patch.priority ?? existing.priority,
    assigneeId: patch.assigneeId !== undefined ? patch.assigneeId || null : existing.assigneeId ?? null,
    dueAt: patch.dueAt !== undefined ? patch.dueAt || null : existing.dueAt ?? null,
    doneAt,
    points: patch.points ?? existing.points,
    updatedAt: now,
  });

  if (patch.visibleTo) replaceViewers(id, patch.visibleTo);
  return getTask(id);
}

export function deleteTask(id: string) {
  db.prepare(`DELETE FROM task_viewers WHERE task_id = ?`).run(id);
  db.prepare(`DELETE FROM tasks WHERE id = ?`).run(id);
}

/**
 * KPI считается одним агрегатом в SQLite, а не переносом всех задач на клиент:
 * при тысячах задач второй вариант положил бы страницу.
 */
export function taskKpi(fromIso: string | null, onlyUserId?: string): TaskKpiRow[] {
  const rows = db
    .prepare(
      `SELECT u.id AS user_id, u.name AS user_name,
              COUNT(t.id) AS assigned,
              SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) AS done,
              SUM(CASE WHEN t.status = 'done' AND (t.due_at IS NULL OR t.done_at <= t.due_at) THEN 1 ELSE 0 END) AS on_time,
              SUM(CASE WHEN t.status = 'done' AND t.due_at IS NOT NULL AND t.done_at > t.due_at THEN 1 ELSE 0 END) AS late,
              SUM(CASE WHEN t.status = 'done' THEN t.points ELSE 0 END) AS points,
              AVG(CASE WHEN t.status = 'done' THEN (julianday(t.done_at) - julianday(t.created_at)) * 24 END) AS avg_hours
       FROM app_users u
       LEFT JOIN tasks t
         ON t.assignee_id = u.id
        AND (@from IS NULL OR t.created_at >= @from)
       WHERE u.is_active = 1 AND (@onlyUser IS NULL OR u.id = @onlyUser)
       GROUP BY u.id, u.name
       ORDER BY points DESC, done DESC, u.name`
    )
    .all({ from: fromIso, onlyUser: onlyUserId ?? null }) as {
    user_id: string;
    user_name: string;
    assigned: number;
    done: number;
    on_time: number;
    late: number;
    points: number;
    avg_hours: number | null;
  }[];

  return rows.map((r) => {
    const assigned = r.assigned ?? 0;
    const done = r.done ?? 0;
    const onTime = r.on_time ?? 0;
    // 60% — сколько задач закрыто, 40% — сколько из них уложились в срок
    const doneRatio = assigned ? done / assigned : 0;
    const onTimeRatio = done ? onTime / done : 0;
    return {
      userId: r.user_id,
      userName: r.user_name,
      assigned,
      done,
      onTime,
      late: r.late ?? 0,
      points: r.points ?? 0,
      avgHours: r.avg_hours === null ? null : Math.round(r.avg_hours * 10) / 10,
      score: assigned === 0 ? 0 : Math.round((doneRatio * 0.6 + onTimeRatio * 0.4) * 100),
    };
  });
}

// ---------- Пользователи (RBAC) ----------

import bcrypt from "bcryptjs";
import { AppUser, Permission } from "./types";

interface UserRow {
  id: string;
  login: string;
  password_hash: string;
  name: string;
  position: string | null;
  is_admin: number;
  is_active: number;
  permissions_json: string;
  created_at: string;
}

function userRowToDomain(row: UserRow): AppUser {
  return {
    id: row.id,
    login: row.login,
    name: row.name,
    position: row.position ?? undefined,
    isAdmin: row.is_admin === 1,
    isActive: row.is_active === 1,
    permissions: JSON.parse(row.permissions_json || "[]") as Permission[],
    createdAt: row.created_at,
  };
}

export function listUsers(): AppUser[] {
  return (db.prepare(`SELECT * FROM app_users ORDER BY created_at`).all() as UserRow[]).map(userRowToDomain);
}

export function getUser(id: string): AppUser | null {
  const row = db.prepare(`SELECT * FROM app_users WHERE id = ?`).get(id) as UserRow | undefined;
  return row ? userRowToDomain(row) : null;
}

export function getUserByLogin(login: string): (AppUser & { passwordHash: string }) | null {
  const row = db.prepare(`SELECT * FROM app_users WHERE login = ?`).get(login) as UserRow | undefined;
  if (!row) return null;
  return { ...userRowToDomain(row), passwordHash: row.password_hash };
}

export async function createUser(input: {
  login: string; password: string; name: string;
  position?: string; isActive?: boolean; permissions?: Permission[];
}): Promise<AppUser> {
  const id = newId("usr");
  const now = new Date().toISOString();
  const hash = await bcrypt.hash(input.password, 10);
  db.prepare(
    `INSERT INTO app_users (id, login, password_hash, name, position, is_admin, is_active, permissions_json, created_at)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)`
  ).run(id, input.login, hash, input.name, input.position ?? null, input.isActive !== false ? 1 : 0, JSON.stringify(input.permissions ?? []), now);
  return getUser(id)!;
}

export async function updateUser(id: string, patch: {
  name?: string; position?: string; isActive?: boolean;
  permissions?: Permission[]; password?: string;
}): Promise<AppUser | null> {
  const existing = db.prepare(`SELECT * FROM app_users WHERE id = ?`).get(id) as UserRow | undefined;
  if (!existing) return null;
  const passwordHash = patch.password ? await bcrypt.hash(patch.password, 10) : existing.password_hash;
  db.prepare(
    `UPDATE app_users SET name=?, position=?, is_active=?, permissions_json=?, password_hash=? WHERE id=?`
  ).run(
    patch.name ?? existing.name,
    patch.position !== undefined ? patch.position : existing.position,
    patch.isActive !== undefined ? (patch.isActive ? 1 : 0) : existing.is_active,
    JSON.stringify(patch.permissions ?? JSON.parse(existing.permissions_json)),
    passwordHash,
    id
  );
  return getUser(id);
}

export function deleteUser(id: string) {
  const row = db.prepare(`SELECT is_admin FROM app_users WHERE id = ?`).get(id) as { is_admin: number } | undefined;
  if (row?.is_admin) throw new Error("Нельзя удалить главного администратора");
  db.prepare(`DELETE FROM app_users WHERE id = ?`).run(id);
}

export async function verifyPassword(login: string, password: string): Promise<AppUser | null> {
  const user = getUserByLogin(login);
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;
  if (!user.isActive) return null;
  return user;
}

// ---------- Настройки компании ----------

export type CompanySettings = {
  company_name: string;
  company_bin: string;
  company_address: string;
  company_phone: string;
  company_email: string;
  company_bank: string;
  company_bik: string;
  company_account: string;
  company_director: string;
  company_logo_url: string;
  currency: string;
  city: string;
};

export function getCompanySettings(): CompanySettings {
  const rows = db.prepare(`SELECT key, value FROM company_settings`).all() as { key: string; value: string }[];
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  return map as CompanySettings;
}

export function updateCompanySettings(patch: Partial<CompanySettings>): CompanySettings {
  const stmt = db.prepare(`INSERT INTO company_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`);
  for (const [k, v] of Object.entries(patch)) stmt.run(k, v ?? "");
  return getCompanySettings();
}
