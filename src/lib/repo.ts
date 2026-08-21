import { db, logActivity } from "./db";
import { Client, DocumentTemplate, InventoryItem, InventoryLine, Rental, RentalDocument, RentalStatus, WorkshopLine, WorkshopTicket } from "./types";

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

export function createClient(input: Partial<Client>): Client {
  const id = newId("cl");
  const createdAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO clients (id, name, type, phone, email, photo_url, iin, birth_date, document_number, document_issued_by, document_issued_at, document_expires_at, acquisition_channel, discount, rating, blacklisted, created_at)
     VALUES (@id, @name, @type, @phone, @email, @photoUrl, @iin, @birthDate, @documentNumber, @documentIssuedBy, @documentIssuedAt, @documentExpiresAt, @acquisitionChannel, @discount, @rating, @blacklisted, @createdAt)`
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
    sku: input.sku ?? null,
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
    number: row.number,
    status: row.status as RentalStatus,
    paymentStatus: row.payment_status as Rental["paymentStatus"],
    branch: row.branch ?? "",
    startDate: "",
    endDate: "",
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

export function createRental(input: Rental): Rental {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO rentals (id, number, status, payment_status, branch, start_at, end_at, rental_period, client_id, total, paid,
      booked_by_name, issued_by_name, comment, delivery, auto_penalty_enabled, penalty_rate_per_hour,
      items_json, deposit_json, penalties_json, expenses_json, documents_json, notes_json, created_at, updated_at)
     VALUES (@id, @number, @status, @payment_status, @branch, @start_at, @end_at, @rental_period, @client_id, @total, @paid,
      @booked_by_name, @issued_by_name, @comment, @delivery, @auto_penalty_enabled, @penalty_rate_per_hour,
      @items_json, @deposit_json, @penalties_json, @expenses_json, @documents_json, @notes_json, @created_at, @updated_at)`
  ).run(toRentalRow(input, now, now));

  applyInventoryLock(input.items, "rented");
  logActivity(`Оформлена аренда ${input.number}`);
  return getRental(input.id)!;
}

export function updateRental(id: string, patch: Partial<Rental>) {
  const existingRow = db.prepare(`SELECT * FROM rentals WHERE id = ?`).get(id) as RentalRow | undefined;
  if (!existingRow) return null;
  const existing = rentalRowToDomain(existingRow)!;
  const merged: Rental = { ...existing, ...patch, client: patch.client ?? existing.client };
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
  return getRental(id);
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
  const active = db.prepare(`SELECT * FROM rentals WHERE status IN ('active','booked')`).all() as RentalRow[];
  let markedOverdue = 0;
  let penaltiesAdded = 0;

  for (const row of active) {
    const end = new Date(row.end_at).getTime();
    if (now <= end) continue;

    const hoursLate = Math.floor((now - end) / 3600000);
    let penalties = JSON.parse(row.penalties_json || "[]") as { reason: string; amount: number }[];

    if (row.status !== "overdue") {
      db.prepare(`UPDATE rentals SET status = 'overdue', updated_at = ? WHERE id = ?`).run(new Date().toISOString(), row.id);
      markedOverdue++;
    }

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
    "{{client_bin}}": client.iin ?? "",
    "{{client_address}}": "",
    "{{client_director}}": client.name,
    "{{client_account}}": "",
    "{{client_bik}}": "",
    "{{client_bank}}": "",

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
