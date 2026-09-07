import { db, logActivity } from "./db";
import { isOneTimeLine, lineTotal } from "./utils";
import { branches } from "./mock-data";
import { Client, ClientRatingBreakdown, ImportReport, ShopProduct, DocumentTemplate, InventoryCheck, InventoryItem, InventoryLine, Kit, KitLine, Rental, RentalDocument, RentalEvent, RentalPause, RentalStatus, Delivery, Lead, Service, ServiceTariff, Task, TaskKpiRow, TaskPriority, TaskStatus, WorkshopLine, WorkshopTicket } from "./types";

/** Ошибка с кодом ответа: роут отдаст её пользователю, а не «500 Внутренняя ошибка» */
function httpError(status: number, message: string) {
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  return err;
}

/** Только цифры: +7 707 370-51-31 и 87073705131 — один и тот же номер */
function onlyDigits(value: string) {
  return value.replace(/D/g, "");
}

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
  notes: string | null;
  rating: number | null;
  blacklisted: number;
  created_at: string;
}

/** Аренда глазами рейтинга: сколько должен, вернул ли вовремя */
interface RentalForRating {
  total: number;
  paid: number;
  status: string;
  start_at: string;
  end_at: string;
  returned_at: string | null;
}

/**
 * Рейтинг клиента 1–5 звёзд. Вручную его никто не ставит — он складывается
 * из трёх вещей, которые важны прокату:
 *   • как часто человек возвращается (30 %)
 *   • платит ли полностью (35 %)
 *   • возвращает ли инструмент в срок (35 %)
 * Черновики и отменённые аренды в расчёт не идут: по ним судить не о чем.
 */
function computeClientRating(rows: RentalForRating[], blacklisted: boolean) {
  const counted = rows.filter((r) => r.status !== "draft" && r.status !== "cancelled");
  const debt = counted.reduce((sum, r) => sum + Math.max(0, r.total - r.paid), 0);
  const lateReturns = counted.filter((r) => isLateReturn(r)).length;

  const breakdown: ClientRatingBreakdown = {
    loyalty: 0,
    payment: 0,
    punctuality: 0,
    rentals: counted.length,
    debt,
    lateReturns,
  };

  // Ни одной аренды — рейтинга ещё нет, ставить «1 звезда» новичку нечестно
  if (counted.length === 0) return { rating: undefined, breakdown };

  // Кража или чёрный список перевешивают любую статистику
  if (blacklisted || counted.some((r) => r.status === "stolen")) {
    return { rating: 1, breakdown };
  }

  // Лояльность: первая аренда — 20 %, десятая и дальше — 100 %
  const loyaltySteps = [1, 2, 3, 5, 10];
  const loyalty = loyaltySteps.filter((n) => counted.length >= n).length / loyaltySteps.length;

  // Оплата: доля аренд, закрытых полностью
  const fullyPaid = counted.filter((r) => r.paid >= r.total).length;
  const payment = fullyPaid / counted.length;

  // Пунктуальность: доля возвратов не позже конца срока
  const punctuality = (counted.length - lateReturns) / counted.length;

  breakdown.loyalty = Math.round(loyalty * 100);
  breakdown.payment = Math.round(payment * 100);
  breakdown.punctuality = Math.round(punctuality * 100);

  const score = 0.3 * loyalty + 0.35 * payment + 0.35 * punctuality;
  const rating = Math.min(5, Math.max(1, Math.round(1 + 4 * score)));
  return { rating, breakdown };
}

/**
 * Опоздание с возвратом. Завершённую аренду сверяем с фактической датой
 * возврата, а если её нет (аренда закрыта до появления поля) — считаем
 * опозданием только явный статус «просрочена». Идущую аренду — по текущему
 * времени: инструмент до сих пор у клиента, срок уже вышел.
 */
function isLateReturn(r: RentalForRating): boolean {
  const deadline = new Date(r.end_at).getTime();
  if (!Number.isFinite(deadline)) return false;
  if (r.returned_at) return new Date(r.returned_at).getTime() > deadline;
  if (r.status === "completed") return false;
  if (r.status === "overdue") return true;
  return r.status === "active" && Date.now() > deadline;
}

function clientRowToDomain(row: ClientRow, rentalRows: RentalForRating[]): Client {
  const totalRentals = rentalRows.length;
  const totalSpent = rentalRows.reduce((s, r) => s + r.paid, 0);
  const repeatRentals = Math.max(0, totalRentals - 1);
  const overdueCount = rentalRows.filter((r) => r.status === "overdue").length;
  const lastRentalDate = rentalRows.length ? rentalRows.map((r) => r.start_at).sort().slice(-1)[0]?.slice(0, 10) : undefined;
  const { rating, breakdown } = computeClientRating(rentalRows, !!row.blacklisted);

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
    notes: row.notes ?? undefined,
    // Рейтинг считается, а не хранится: колонка rating осталась от ручного
    // выставления и больше не используется
    rating,
    ratingBreakdown: breakdown,
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
  return db
    .prepare(`SELECT total, paid, status, start_at, end_at, returned_at FROM rentals WHERE client_id = ?`)
    .all(clientId) as RentalForRating[];
}

/**
 * Все аренды, сгруппированные по клиенту. Раньше список клиентов делал по
 * отдельному SELECT на каждого: на шести тысячах карточек это шесть тысяч
 * запросов и полторы секунды только на выборку. Теперь один проход по таблице.
 */
function rentalSummariesByClient(): Map<string, RentalForRating[]> {
  const rows = db
    .prepare(`SELECT client_id, total, paid, status, start_at, end_at, returned_at FROM rentals`)
    .all() as (RentalForRating & { client_id: string })[];

  const map = new Map<string, RentalForRating[]>();
  for (const row of rows) {
    const list = map.get(row.client_id);
    if (list) list.push(row);
    else map.set(row.client_id, [row]);
  }
  return map;
}

export function listClients(): Client[] {
  const rows = db.prepare(`SELECT * FROM clients ORDER BY created_at DESC`).all() as ClientRow[];
  const byClient = rentalSummariesByClient();
  return rows.map((row) => clientRowToDomain(row, byClient.get(row.id) ?? []));
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
    `INSERT INTO clients (id, name, type, phone, email, photo_url, iin, birth_date, document_number, document_issued_by, document_issued_at, document_expires_at, bin, legal_address, company_director, bank_account, bank, bik, acquisition_channel, discount, rating, notes, blacklisted, created_at)
     VALUES (@id, @name, @type, @phone, @email, @photoUrl, @iin, @birthDate, @documentNumber, @documentIssuedBy, @documentIssuedAt, @documentExpiresAt, @bin, @legalAddress, @companyDirector, @bankAccount, @bank, @bik, @acquisitionChannel, @discount, @rating, @notes, @blacklisted, @createdAt)`
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
    notes: input.notes ?? null,
    blacklisted: input.blacklisted ? 1 : 0,
    // При импорте сохраняем дату из выгрузки, иначе вся база «заведена сегодня»
    createdAt: input.createdAt ?? createdAt,
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
     acquisition_channel=@acquisition_channel, discount=@discount, rating=@rating, notes=@notes, blacklisted=@blacklisted WHERE id=@id`
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
    notes: patch.notes !== undefined ? patch.notes || null : existing.notes,
    blacklisted: patch.blacklisted !== undefined ? (patch.blacklisted ? 1 : 0) : existing.blacklisted,
  });
  return getClient(id);
}

/** Сколько аренд числится за клиентом — по ним включён внешний ключ */
function rentalCountForClient(id: string) {
  return (db.prepare(`SELECT COUNT(*) AS c FROM rentals WHERE client_id = ?`).get(id) as { c: number }).c;
}

export function deleteClient(id: string) {
  const c = getClient(id);
  // Без этой проверки SQLite отдавал «500 Внутренняя ошибка» из-за внешнего ключа,
  // и менеджер не понимал, почему клиент не удаляется
  const rentals = rentalCountForClient(id);
  if (rentals > 0) {
    throw httpError(409, `У клиента ${rentals} аренд(ы). Сначала удалите их или выберите «Удалить вместе с арендами».`);
  }
  db.prepare(`DELETE FROM clients WHERE id = ?`).run(id);
  if (c) logActivity(`Удалён клиент «${c.name}»`);
}

/**
 * Массовое удаление клиентов — чтобы разом убрать наигранные тестовые записи.
 * Клиента с арендами трогаем только по явному запросу: сначала уходят его аренды
 * (инвентарь при этом освобождается), потом он сам. Остальных возвращаем списком
 * пропущенных, чтобы человек видел, что именно не удалилось и почему.
 */
export function deleteClients(ids: string[], options: { withRentals?: boolean } = {}) {
  const skipped: { id: string; name: string; rentals: number }[] = [];
  let deleted = 0;
  let deletedRentals = 0;

  const run = db.transaction(() => {
    for (const id of ids) {
      const client = getClient(id);
      if (!client) continue;
      const rentals = rentalCountForClient(id);

      if (rentals > 0 && !options.withRentals) {
        skipped.push({ id, name: client.name, rentals });
        continue;
      }
      if (rentals > 0) {
        const rows = db.prepare(`SELECT id FROM rentals WHERE client_id = ?`).all(id) as { id: string }[];
        for (const row of rows) {
          deleteRental(row.id);
          deletedRentals++;
        }
      }
      db.prepare(`DELETE FROM clients WHERE id = ?`).run(id);
      deleted++;
    }
  });
  run();

  if (deleted > 0) {
    logActivity(`Удалено клиентов: ${deleted}${deletedRentals ? `, вместе с арендами: ${deletedRentals}` : ""}`);
  }
  return { deleted, deletedRentals, skipped };
}


/**
 * Переносит в уже заведённую карточку признаки из строки-дубля. Обновляем только
 * то, что усиливает карточку: чёрный список, юрлицо, недостающие поля. Заполненное
 * не затираем — первая строка обычно свежее.
 */
function mergeImportedClient(id: string, row: Partial<Client>) {
  const existing = getClient(id);
  if (!existing) return;

  const patch: Partial<Client> = {};
  if (row.blacklisted && !existing.blacklisted) patch.blacklisted = true;
  if (row.type === "company" && existing.type !== "company") patch.type = "company";
  if (row.notes && !existing.notes) patch.notes = row.notes;
  if (row.email && !existing.email) patch.email = row.email;
  if (row.acquisitionChannel && !existing.acquisitionChannel) patch.acquisitionChannel = row.acquisitionChannel;
  if (row.iin && !existing.iin) patch.iin = row.iin;
  if (row.bin && !existing.bin) patch.bin = row.bin;
  if (row.phone && !existing.phone) patch.phone = row.phone;

  if (Object.keys(patch).length > 0) updateClient(id, patch);
}

function countReason(reasons: Record<string, number>, reason: string) {
  reasons[reason] = (reasons[reason] ?? 0) + 1;
}

/**
 * Импорт клиентов из выгрузки. Ключ — телефон без форматирования: в старых базах
 * один и тот же человек заведён по нескольку раз, и без этой проверки дубли
 * расползлись бы по всей системе.
 *
 * У части записей телефона нет вовсе (в выгрузке там стоит один плюс). Такие тоже
 * заводим — это живая история клиента, терять её нельзя, — но схлопываем по имени,
 * иначе дубли старой базы переедут к нам как есть.
 *
 * Всё одной транзакцией: десять тысяч отдельных INSERT упираются в диск и идут минутами.
 */
export function importClients(rows: Partial<Client>[]): ImportReport {
  // Ключ → id карточки. Телефон для тех, у кого он есть; имя — для остальных.
  // Карта строится по всей базе: метка из файла должна доехать и до карточки,
  // которая существовала до импорта
  const byKey = new Map<string, string>();
  for (const row of db.prepare(`SELECT id, name, phone FROM clients`).all() as {
    id: string;
    name: string;
    phone: string;
  }[]) {
    const digits = onlyDigits(row.phone);
    const key = digits || `name:${row.name.trim().toLowerCase()}`;
    if (!byKey.has(key)) byKey.set(key, row.id);
  }
  const reasons: Record<string, number> = {};
  let added = 0;
  let skipped = 0;
  let withoutPhone = 0;

  const run = db.transaction(() => {
    for (const row of rows) {
      const name = (row.name ?? "").trim();
      if (!name) {
        skipped++;
        countReason(reasons, "без имени");
        continue;
      }

      const phone = onlyDigits((row.phone ?? "").toString());
      const key = phone || `name:${name.toLowerCase()}`;

      const existingId = byKey.get(key);
      if (existingId) {
        skipped++;
        countReason(reasons, phone ? "телефон уже есть в базе" : "такой клиент без телефона уже есть");
        // Строка-дубль могла принести то, чего не было в первой: чёрный список,
        // тип «юр. лицо», пометку. Это не теряем, а переносим в карточку
        mergeImportedClient(existingId, row);
        continue;
      }

      if (!phone) withoutPhone++;
      byKey.set(key, createClient({ ...row, name }).id);
      added++;
    }
  });
  run();

  if (added) logActivity(`Импортировано клиентов: ${added}`);
  if (withoutPhone) reasons["добавлено без телефона"] = withoutPhone;
  return { added, skipped, reasons };
}

/**
 * Импорт каталога. Строка выгрузки — это продукт с количеством единиц, поэтому
 * заводим столько записей, сколько указано в «Количестве»: учёт в системе
 * поштучный, у каждой единицы свой артикул и своя история.
 */
export function importInventoryItems(
  rows: (Partial<InventoryItem> & { quantity?: number })[]
): ImportReport & { units: number } {
  const existingSkus = new Set(
    (db.prepare(`SELECT sku FROM inventory_items WHERE sku IS NOT NULL`).all() as { sku: string }[]).map((r) =>
      r.sku.trim().toLowerCase()
    )
  );
  const reasons: Record<string, number> = {};
  let added = 0;
  let skipped = 0;
  let units = 0;

  const run = db.transaction(() => {
    for (const row of rows) {
      const name = (row.name ?? "").trim();
      if (!name) {
        skipped++;
        countReason(reasons, "без названия");
        continue;
      }

      // Артикул уникален: повторный импорт того же файла не должен плодить копии
      const sku = (row.sku ?? "").trim();
      if (sku && existingSkus.has(sku.toLowerCase())) {
        skipped++;
        countReason(reasons, "артикул уже есть в базе");
        continue;
      }
      if (sku) existingSkus.add(sku.toLowerCase());

      const quantity = Math.max(1, Math.floor(row.quantity ?? 1));
      units += createInventoryItems({ ...row, name }, quantity).length;
      added++;
    }
  });
  run();

  if (units) logActivity(`Импортировано позиций каталога: ${added} (единиц: ${units})`);
  return { added, skipped, reasons, units };
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
    // Импорт приносит дату из выгрузки: без неё вся база выглядит заведённой сегодня
    createdAt: input.createdAt ?? createdAt,
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
  // На товар могут ссылаться заявки мастерской — без проверки SQLite отдавал 500
  // из-за внешнего ключа, и пользователь видел пустую ошибку
  const tickets = (db.prepare(`SELECT COUNT(*) AS c FROM workshop_tickets WHERE inventory_item_id = ?`).get(id) as { c: number }).c;
  if (tickets > 0) {
    throw httpError(
      409,
      `Инструмент есть в заявках мастерской (${tickets}). Удалите заявки или переведите инструмент в статус «Списан».`
    );
  }
  db.prepare(`DELETE FROM inventory_checks WHERE inventory_item_id = ?`).run(id);
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
    // Заданный артикул достаётся первой единице, остальным система присвоит свои:
    // иначе при импорте номер из файла терялся и повторная загрузка плодила дубли
    created.push(createInventoryItem({ ...input, sku: i === 0 ? input.sku : undefined }));
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

// ---------- Магазин: товары на продажу ----------

interface ShopProductRow {
  id: string;
  name: string;
  sku: string | null;
  serial_number: string | null;
  category: string | null;
  price: number;
  purchase_cost: number | null;
  qty: number;
  photo_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
}

function shopRowToDomain(row: ShopProductRow): ShopProduct {
  return {
    id: row.id,
    name: row.name,
    sku: row.sku ?? "",
    serialNumber: row.serial_number ?? undefined,
    category: row.category ?? undefined,
    price: row.price,
    purchaseCost: row.purchase_cost ?? undefined,
    qty: row.qty,
    photoUrl: row.photo_url ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,
  };
}

export function listShopProducts(search?: string): ShopProduct[] {
  const rows = search?.trim()
    ? (db
        .prepare(
          `SELECT * FROM shop_products
           WHERE LOWER(name) LIKE @q OR LOWER(COALESCE(sku, '')) LIKE @q OR LOWER(COALESCE(serial_number, '')) LIKE @q
           ORDER BY name`
        )
        .all({ q: `%${search.trim().toLowerCase()}%` }) as ShopProductRow[])
    : (db.prepare(`SELECT * FROM shop_products ORDER BY name`).all() as ShopProductRow[]);
  return rows.map(shopRowToDomain);
}

export function getShopProduct(id: string): ShopProduct | null {
  const row = db.prepare(`SELECT * FROM shop_products WHERE id = ?`).get(id) as ShopProductRow | undefined;
  return row ? shopRowToDomain(row) : null;
}

/**
 * Инвентарный и серийный номера у товара магазина свои и не должны повторяться:
 * по ним продавец находит позицию на полке и в накладной поставщика.
 */
function assertShopNumbersFree(sku: string, serial: string | undefined, exceptId?: string) {
  if (sku) {
    const clash = db
      .prepare(`SELECT id FROM shop_products WHERE LOWER(sku) = LOWER(?) AND id != ?`)
      .get(sku, exceptId ?? "") as { id: string } | undefined;
    if (clash) throw httpError(409, `Инвентарный номер ${sku} уже занят другим товаром магазина`);
  }
  if (serial) {
    const clash = db
      .prepare(`SELECT id FROM shop_products WHERE LOWER(serial_number) = LOWER(?) AND id != ?`)
      .get(serial, exceptId ?? "") as { id: string } | undefined;
    if (clash) throw httpError(409, `Серийный номер ${serial} уже занят другим товаром магазина`);
  }
}

/** Инвентарный номер по порядку: МГ-1, МГ-2 — если продавец не задал свой */
const nextShopSku = db.transaction((): string => {
  const row = db.prepare(`SELECT value FROM company_settings WHERE key = 'shop_counter'`).get() as
    | { value: string }
    | undefined;
  const next = row
    ? Number(row.value) + 1
    : (db.prepare(`SELECT COUNT(*) AS c FROM shop_products`).get() as { c: number }).c + 1;
  db.prepare(
    `INSERT INTO company_settings (key, value) VALUES ('shop_counter', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(String(next));
  return `МГ-${next}`;
});

export function createShopProduct(input: Partial<ShopProduct>): ShopProduct {
  const name = (input.name ?? "").trim();
  if (!name) throw httpError(400, "Укажите название товара");

  const sku = (input.sku ?? "").trim() || nextShopSku();
  const serial = (input.serialNumber ?? "").trim() || undefined;
  assertShopNumbersFree(sku, serial);

  const id = newId("shop");
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO shop_products (id, name, sku, serial_number, category, price, purchase_cost, qty, photo_url, notes, created_at, updated_at)
     VALUES (@id, @name, @sku, @serialNumber, @category, @price, @purchaseCost, @qty, @photoUrl, @notes, @createdAt, @updatedAt)`
  ).run({
    id,
    name,
    sku,
    serialNumber: serial ?? null,
    category: input.category?.trim() || null,
    price: input.price ?? 0,
    purchaseCost: input.purchaseCost ?? null,
    qty: input.qty ?? 0,
    photoUrl: input.photoUrl ?? null,
    notes: input.notes?.trim() || null,
    createdAt: now,
    updatedAt: now,
  });
  logActivity(`Магазин: добавлен товар «${name}»`);
  return getShopProduct(id)!;
}

export function updateShopProduct(id: string, patch: Partial<ShopProduct>): ShopProduct | null {
  const existing = getShopProduct(id);
  if (!existing) return null;

  const sku = patch.sku !== undefined ? patch.sku.trim() || existing.sku : existing.sku;
  const serial = patch.serialNumber !== undefined ? patch.serialNumber.trim() || undefined : existing.serialNumber;
  assertShopNumbersFree(sku, serial, id);

  db.prepare(
    `UPDATE shop_products SET name=@name, sku=@sku, serial_number=@serialNumber, category=@category,
     price=@price, purchase_cost=@purchaseCost, qty=@qty, photo_url=@photoUrl, notes=@notes, updated_at=@updatedAt
     WHERE id=@id`
  ).run({
    id,
    name: (patch.name ?? existing.name).trim(),
    sku,
    serialNumber: serial ?? null,
    category: patch.category !== undefined ? patch.category.trim() || null : existing.category ?? null,
    price: patch.price ?? existing.price,
    purchaseCost: patch.purchaseCost !== undefined ? patch.purchaseCost : existing.purchaseCost ?? null,
    qty: patch.qty ?? existing.qty,
    photoUrl: patch.photoUrl !== undefined ? patch.photoUrl || null : existing.photoUrl ?? null,
    notes: patch.notes !== undefined ? patch.notes.trim() || null : existing.notes ?? null,
    updatedAt: new Date().toISOString(),
  });
  return getShopProduct(id);
}

export function deleteShopProduct(id: string) {
  db.prepare(`DELETE FROM shop_products WHERE id = ?`).run(id);
}

/** Сводка для шапки раздела: сколько позиций, штук и денег лежит на полке */
export function shopSummary() {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS positions,
              COALESCE(SUM(qty), 0) AS units,
              COALESCE(SUM(qty * price), 0) AS value,
              COALESCE(SUM(CASE WHEN qty <= 0 THEN 1 ELSE 0 END), 0) AS outOfStock
       FROM shop_products`
    )
    .get() as { positions: number; units: number; value: number; outOfStock: number };
  return row;
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
  paid_at: string | null;
  returned_at: string | null;
  shop_written_off: number;
  items_json: string;
  deposit_json: string | null;
  penalties_json: string;
  expenses_json: string;
  documents_json: string;
  notes_json: string;
  created_at: string;
  updated_at: string;
}

/** `client` передают, когда клиенты уже подняты пачкой — чтобы не ходить за каждым */
function rentalRowToDomain(row: RentalRow, client?: Client): Rental | null {
  const resolved = client ?? getClient(row.client_id);
  if (!resolved) return null;
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
    client: resolved,
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
    paidAt: row.paid_at ?? undefined,
    returnedAt: row.returned_at ?? undefined,
    autoPenaltyEnabled: !!row.auto_penalty_enabled,
    penaltyRatePerHour: row.penalty_rate_per_hour ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Список аренд. Клиентов собираем разом и раздаём по ссылке: `rentalRowToDomain`
 * зовёт `getClient()`, а тот пересчитывает статистику и рейтинг — на трёх тысячах
 * аренд это тысячи лишних запросов и секунда ожидания на каждой странице.
 */
export function listRentals(): Rental[] {
  const rows = db.prepare(`SELECT * FROM rentals ORDER BY created_at DESC`).all() as RentalRow[];
  const clients = new Map(listClients().map((c) => [c.id, c]));
  return rows
    .map((row) => {
      const client = clients.get(row.client_id);
      return client ? rentalRowToDomain(row, client) : null;
    })
    .filter((r): r is Rental => r !== null);
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
    // Товар магазина продан, а не выдан: в каталоге аренды его вообще нет
    if (item.inventoryItemId && item.category !== "shop") {
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

/**
 * Товары магазина продаются безвозвратно, поэтому со склада они списываются
 * ровно один раз — в момент выдачи. Флаг shop_written_off страхует от
 * повторного списания, когда аренду правят или откатывают.
 */
function syncShopStock(rentalId: string, nextStatus: string, items: InventoryLine[]) {
  const shopLines = items.filter((i) => i.category === "shop" && i.inventoryItemId);
  if (shopLines.length === 0) return;

  const row = db.prepare(`SELECT shop_written_off FROM rentals WHERE id = ?`).get(rentalId) as
    | { shop_written_off: number }
    | undefined;
  const written = !!row?.shop_written_off;
  const sold = nextStatus === "active" || nextStatus === "completed" || nextStatus === "overdue" || nextStatus === "stolen";

  if (sold && !written) {
    for (const line of shopLines) {
      db.prepare(`UPDATE shop_products SET qty = MAX(0, qty - ?) WHERE id = ?`).run(line.qty, line.inventoryItemId);
    }
    db.prepare(`UPDATE rentals SET shop_written_off = 1 WHERE id = ?`).run(rentalId);
    return;
  }

  // Аренду отменили или вернули в черновик — товар физически не ушёл, возвращаем
  if (!sold && written) {
    for (const line of shopLines) {
      db.prepare(`UPDATE shop_products SET qty = qty + ? WHERE id = ?`).run(line.qty, line.inventoryItemId);
    }
    db.prepare(`UPDATE rentals SET shop_written_off = 0 WHERE id = ?`).run(rentalId);
  }
}

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
  syncShopStock(input.id, input.status, input.items);
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

/** Проставляет дату записям штрафов и расходов, у которых её ещё нет */
function stampEntries<T extends { createdAt?: string }>(list: T[] | undefined, now: string): T[] {
  return (list ?? []).map((e) => (e.createdAt ? e : { ...e, createdAt: now }));
}

export function updateRental(id: string, patch: Partial<Rental>, options: { silent?: boolean; actorName?: string } = {}) {
  const existingRow = db.prepare(`SELECT * FROM rentals WHERE id = ?`).get(id) as RentalRow | undefined;
  if (!existingRow) return null;
  const existing = rentalRowToDomain(existingRow)!;
  // Номер аренды не перезаписываем пустым: его присвоил сервер при создании
  const now = new Date().toISOString();
  const merged: Rental = {
    ...existing,
    ...patch,
    number: patch.number || existing.number,
    client: patch.client ?? existing.client,
    penalties: stampEntries(patch.penalties ?? existing.penalties, now),
    expenses: stampEntries(patch.expenses ?? existing.expenses, now),
  };
  db.prepare(
    `UPDATE rentals SET number=@number, status=@status, payment_status=@payment_status, branch=@branch, start_at=@start_at, end_at=@end_at,
     rental_period=@rental_period, client_id=@client_id, total=@total, paid=@paid, booked_by_name=@booked_by_name, issued_by_name=@issued_by_name,
     comment=@comment, delivery=@delivery, auto_penalty_enabled=@auto_penalty_enabled, penalty_rate_per_hour=@penalty_rate_per_hour,
     items_json=@items_json, deposit_json=@deposit_json, penalties_json=@penalties_json, expenses_json=@expenses_json,
     documents_json=@documents_json, notes_json=@notes_json, updated_at=@updated_at WHERE id=@id`
  ).run(toRentalRow(merged, existingRow.created_at, now));

  // Оплата изменилась — запоминаем когда. Иначе в финансах платёж попадал на дату
  // создания аренды, и отчёты по периодам врали
  if (merged.paid !== existing.paid) {
    db.prepare(`UPDATE rentals SET paid_at = ? WHERE id = ?`).run(merged.paid > 0 ? now : null, id);
  }

  // Дата фактического возврата: по ней считается пунктуальность клиента.
  // Откатили завершение — дату убираем, иначе рейтинг останется врать
  if (merged.status === "completed" && existing.status !== "completed") {
    db.prepare(`UPDATE rentals SET returned_at = COALESCE(returned_at, ?) WHERE id = ?`).run(now, id);
  } else if (merged.status !== "completed" && existing.status === "completed") {
    db.prepare(`UPDATE rentals SET returned_at = NULL WHERE id = ?`).run(id);
  }

  syncShopStock(id, merged.status, merged.items);

  if (merged.status === "completed" || merged.status === "cancelled") {
    applyInventoryLock(merged.items, "available");
  }

  const updated = getRental(id);
  // silent — при откате: там своё событие, иначе история зациклится
  if (updated && !options.silent) diffRentalToEvents(existing, updated, options.actorName);
  return updated;
}

/** Строка аренды из выгрузки — то, что отдаёт парсер `rental-io.ts` */
export interface RentalImportInput {
  number: string;
  clientName: string;
  clientPhone: string;
  status: RentalStatus;
  paymentStatus: Rental["paymentStatus"];
  startAt?: string;
  endAt?: string;
  returnedAt?: string;
  total: number;
  paid: number;
  discount: number;
  createdAt?: string;
  items: { name: string; sku: string }[];
}

/**
 * Импорт истории аренд. Строки пишем напрямую, минуя createRental: он вешает
 * инструмент в «в аренде» и заводит событие «Создал» — для трёх тысяч закрытых
 * аренд это и неверно, и лишний мусор в истории.
 *
 * Клиента ищем по телефону, затем по имени, и заводим только если не нашли:
 * аренда без клиента в базе не живёт (внешний ключ), а плодить двойников нельзя.
 * Позиции привязываем к каталогу по артикулу; чего нет — остаётся текстом,
 * чтобы состав аренды не потерялся.
 */
export function importRentals(rows: RentalImportInput[]): ImportReport & {
  clientsCreated: number;
  itemsLinked: number;
  itemsCreated: number;
  itemsUnmatched: number;
} {
  const reasons: Record<string, number> = {};
  let added = 0;
  let skipped = 0;
  let clientsCreated = 0;
  let itemsLinked = 0;
  let itemsCreated = 0;
  let itemsUnmatched = 0;

  const existingNumbers = new Set(
    (db.prepare(`SELECT number FROM rentals`).all() as { number: string }[]).map((r) => r.number.trim())
  );

  // Клиентов и каталог поднимаем в память: три тысячи аренд по отдельному SELECT
  // превратились бы в десятки тысяч запросов
  const clientByKey = new Map<string, string>();
  for (const c of db.prepare(`SELECT id, name, phone FROM clients`).all() as {
    id: string;
    name: string;
    phone: string;
  }[]) {
    const digits = onlyDigits(c.phone);
    if (digits && !clientByKey.has(digits)) clientByKey.set(digits, c.id);
    const nameKey = `name:${c.name.trim().toLowerCase()}`;
    if (!clientByKey.has(nameKey)) clientByKey.set(nameKey, c.id);
  }

  const itemBySku = new Map<string, { id: string; price: number }>();
  // Образец по названию: у новой единицы должны быть цена и категория такие же,
  // как у её собратьев в каталоге, иначе она заведётся пустой карточкой
  const templateByName = new Map<string, { category: string | null; price: number }>();
  for (const i of db.prepare(`SELECT id, name, sku, category, rental_price FROM inventory_items`).all() as {
    id: string;
    name: string;
    sku: string | null;
    category: string | null;
    rental_price: number;
  }[]) {
    if (i.sku) itemBySku.set(i.sku.trim().toLowerCase(), { id: i.id, price: i.rental_price });
    const nameKey = i.name.trim().toLowerCase();
    if (!templateByName.has(nameKey)) templateByName.set(nameKey, { category: i.category, price: i.rental_price });
  }

  const insertItem = db.prepare(
    `INSERT INTO inventory_items (id, name, sku, category, rental_price, status, branch, created_at)
     VALUES (@id, @name, @sku, @category, @price, 'available', @branch, @createdAt)`
  );

  /**
   * Единица каталога, которой не оказалось под своим артикулом. В выгрузке каталога
   * прошлой системы позиции сгруппированы по продуктам, поэтому артикулы конкретных
   * единиц (QS.0404 и такие же) там просто отсутствуют — а в арендах они есть.
   * Заводим карточку по данным из аренды, цену и категорию берём у одноимённых.
   */
  function ensureInventoryItem(name: string, sku: string, createdAt: string) {
    const template = templateByName.get(name.trim().toLowerCase());
    const id = newId("inv");
    insertItem.run({
      id,
      name,
      sku,
      category: template?.category ?? null,
      price: template?.price ?? 0,
      branch: branches[0] ?? null,
      createdAt,
    });
    const created = { id, price: template?.price ?? 0 };
    itemBySku.set(sku.trim().toLowerCase(), created);
    itemsCreated++;
    return created;
  }

  const insert = db.prepare(
    `INSERT INTO rentals (id, number, status, payment_status, branch, start_at, end_at, rental_period, client_id,
      total, paid, booked_by_name, comment, delivery, auto_penalty_enabled, penalty_rate_per_hour,
      items_json, penalties_json, expenses_json, documents_json, notes_json, returned_at, paid_at, created_at, updated_at)
     VALUES (@id, @number, @status, @paymentStatus, @branch, @startAt, @endAt, 'daily', @clientId,
      @total, @paid, @bookedBy, @comment, 0, 0, 0,
      @itemsJson, '[]', '[]', '[]', '[]', @returnedAt, @paidAt, @createdAt, @createdAt)`
  );

  const markRented = db.prepare(`UPDATE inventory_items SET status = 'rented' WHERE id = ? AND status = 'available'`);

  const run = db.transaction(() => {
    for (const row of rows) {
      const number = (row.number ?? "").trim();
      const clientName = (row.clientName ?? "").trim();

      if (!number) {
        skipped++;
        countReason(reasons, "без номера аренды");
        continue;
      }
      if (existingNumbers.has(number)) {
        skipped++;
        countReason(reasons, "аренда с таким номером уже есть");
        continue;
      }
      if (!clientName) {
        skipped++;
        countReason(reasons, "без клиента");
        continue;
      }

      // Клиент: сначала по телефону, потом по имени, иначе заводим нового
      const digits = onlyDigits(row.clientPhone ?? "");
      const nameKey = `name:${clientName.toLowerCase()}`;
      let clientId = (digits ? clientByKey.get(digits) : undefined) ?? clientByKey.get(nameKey);
      if (!clientId) {
        clientId = createClient({ name: clientName, phone: row.clientPhone ?? "", createdAt: row.createdAt }).id;
        if (digits) clientByKey.set(digits, clientId);
        clientByKey.set(nameKey, clientId);
        clientsCreated++;
      }

      // Позиции привязываем по артикулу. Артикула нет в каталоге — заводим единицу:
      // она реально существовала, раз её выдавали в аренду
      const lines: InventoryLine[] = row.items.map((item, index) => {
        const sku = item.sku.trim();
        let match = sku ? itemBySku.get(sku.toLowerCase()) : undefined;
        if (match) itemsLinked++;
        else if (sku) match = ensureInventoryItem(item.name, sku, row.createdAt ?? row.startAt ?? new Date().toISOString());
        else itemsUnmatched++;
        return {
          id: `imp_${number}_${index}`,
          name: item.name,
          sku: item.sku,
          qty: 1,
          pricePerDay: match?.price ?? 0,
          category: "product" as const,
          inventoryItemId: match?.id,
        };
      });

      const createdAt = row.createdAt ?? row.startAt ?? new Date().toISOString();
      insert.run({
        id: newId("r"),
        number,
        status: row.status,
        paymentStatus: row.paymentStatus,
        branch: branches[0] ?? null,
        startAt: row.startAt ?? createdAt,
        endAt: row.endAt ?? row.startAt ?? createdAt,
        clientId,
        total: row.total,
        paid: row.paid,
        bookedBy: "Импорт",
        comment: row.discount > 0 ? `Скидка при импорте: ${Math.round(row.discount)} ₸` : null,
        itemsJson: JSON.stringify(lines),
        returnedAt: row.returnedAt ?? null,
        paidAt: row.paid > 0 ? row.returnedAt ?? createdAt : null,
        createdAt,
      });
      existingNumbers.add(number);
      added++;

      // Инструмент занят только у тех аренд, которые идут прямо сейчас
      if (row.status === "active" || row.status === "overdue") {
        for (const line of lines) {
          if (line.inventoryItemId) markRented.run(line.inventoryItemId);
        }
      }
    }

    // Счётчик номеров сдвигаем за импортированные: иначе новая аренда получит занятый номер
    const numeric = [...existingNumbers].map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0);
    const maxNumber = numeric.length > 0 ? Math.max(...numeric) : 0;
    if (maxNumber > 0) {
      const current = db.prepare(`SELECT value FROM company_settings WHERE key = 'rental_counter'`).get() as
        | { value: string }
        | undefined;
      if (!current || Number(current.value) < maxNumber) {
        db.prepare(
          `INSERT INTO company_settings (key, value) VALUES ('rental_counter', ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value`
        ).run(String(maxNumber));
      }
    }
  });
  run();

  if (added) logActivity(`Импортировано аренд: ${added}`);
  if (clientsCreated) reasons["заведено новых клиентов"] = clientsCreated;
  if (itemsCreated) reasons["заведено единиц каталога"] = itemsCreated;
  if (itemsCreated) logActivity(`Импорт аренд: заведено единиц каталога — ${itemsCreated}`);
  return { added, skipped, reasons, clientsCreated, itemsLinked, itemsCreated, itemsUnmatched };
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

  // Заявка мастерской и доставка живут своей жизнью: ремонт инструмента и
  // поездку курьера нельзя стирать вместе с арендой. Но ссылку на неё снимаем —
  // из-за внешнего ключа workshop_tickets.source_rental_id удаление падало
  // с «FOREIGN KEY constraint failed», причём откатывалась вся пачка сразу.
  db.prepare(`UPDATE workshop_tickets SET source_rental_id = NULL WHERE source_rental_id = ?`).run(id);
  db.prepare(`UPDATE deliveries SET rental_id = NULL WHERE rental_id = ?`).run(id);

  db.prepare(`DELETE FROM rentals WHERE id = ?`).run(id);
  logActivity(`Удалена аренда №${rental.number}`);
}

/** Массовое удаление аренд: одна транзакция вместо десятка запросов из браузера */
export function deleteRentals(ids: string[]) {
  let deleted = 0;
  const run = db.transaction(() => {
    for (const id of ids) {
      const rental = getRental(id);
      if (!rental) continue;
      deleteRental(id);
      deleted++;
    }
  });
  run();
  return { deleted };
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
    let penalties = JSON.parse(row.penalties_json || "[]") as { reason: string; amount: number; createdAt?: string }[];

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
        const products = items.filter((i) => !isOneTimeLine(i));
        if (products.length > 0) {
          // Фактические дни = от начала аренды до сейчас (минимум 1)
          const actualDays = Math.max(1, Math.ceil((now - start) / 86400000));
          // Оригинальные дни = от начала до конца по договору
          const bookedDays = Math.max(1, Math.ceil((end - start) / 86400000));

          if (actualDays > bookedDays) {
            // Считаем новый total: товары × фактические дни + услуги (фикс)
            const services = items.filter((i) => isOneTimeLine(i));
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
          penalties = [...penalties, { createdAt: new Date().toISOString(), reason: `Авто-штраф за просрочку (час ${h})`, amount: row.penalty_rate_per_hour }];
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

/** Сквозной номер заявки: раньше был обрывок метки времени (WS-770073) */
const nextWorkshopNumber = db.transaction((): string => {
  const row = db.prepare(`SELECT value FROM company_settings WHERE key = 'workshop_counter'`).get() as { value: string } | undefined;
  const next = row
    ? Number(row.value) + 1
    : (db.prepare(`SELECT COUNT(*) AS c FROM workshop_tickets`).get() as { c: number }).c + 1;
  db.prepare(
    `INSERT INTO company_settings (key, value) VALUES ('workshop_counter', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(String(next));
  return `WS-${next}`;
});

export function deleteWorkshopTicket(id: string) {
  db.prepare(`DELETE FROM workshop_tickets WHERE id = ?`).run(id);
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
    number: input.number ?? nextWorkshopNumber(),
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
  /**
   * Сумма прописью. Прошлая версия рекурсивно звала саму себя, а функция в конце
   * дописывала «тенге» — получалось «четыре тенге тысяч(и) пятьсот тенге».
   * Здесь разряды собираются отдельно, «тенге» добавляется один раз, склонения
   * настоящие, тысячи женского рода («одна тысяча», «две тысячи»).
   */
  function numToText(value: number): string {
    const n = Math.max(0, Math.floor(value));
    if (n === 0) return "ноль тенге";

    const unitsM = ["", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
    const unitsF = ["", "одна", "две", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
    const teens = ["десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать", "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать"];
    const tens = ["", "", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят", "восемьдесят", "девяносто"];
    const hundreds = ["", "сто", "двести", "триста", "четыреста", "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот"];

    const plural = (num: number, one: string, few: string, many: string) => {
      const mod100 = num % 100;
      if (mod100 >= 11 && mod100 <= 14) return many;
      const mod10 = num % 10;
      if (mod10 === 1) return one;
      if (mod10 >= 2 && mod10 <= 4) return few;
      return many;
    };

    const group = (num: number, feminine: boolean): string[] => {
      const words: string[] = [];
      const h = Math.floor(num / 100);
      const rest = num % 100;
      if (h) words.push(hundreds[h]);
      if (rest >= 10 && rest < 20) words.push(teens[rest - 10]);
      else {
        const t = Math.floor(rest / 10);
        const u = rest % 10;
        if (t) words.push(tens[t]);
        if (u) words.push(feminine ? unitsF[u] : unitsM[u]);
      }
      return words;
    };

    const parts = [];
    const millions = Math.floor(n / 1000000);
    const thousands = Math.floor((n % 1000000) / 1000);
    const rest = n % 1000;

    if (millions) parts.push(...group(millions, false), plural(millions, "миллион", "миллиона", "миллионов"));
    if (thousands) parts.push(...group(thousands, true), plural(thousands, "тысяча", "тысячи", "тысяч"));
    if (rest) parts.push(...group(rest, false));

    return parts.join(" ") + " тенге";
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
  const inventoryTotal = rental.items.filter((i) => !isOneTimeLine(i)).reduce((s, i) => s + lineTotal(i, durationDays), 0);
  const servicesTotal = rental.items.filter((i) => isOneTimeLine(i)).reduce((s, i) => s + i.pricePerDay * i.qty, 0);
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
    <td style="border:1px solid #ccc;padding:4px 8px;text-align:right">${fmt(lineTotal(i, durationDays))}</td>
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
    "{{products_count}}": String(rental.items.filter((i) => !isOneTimeLine(i)).length),
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


// ---------- Доставка ----------

interface DeliveryRow {
  id: string;
  number: number;
  rental_id: string | null;
  kind: string;
  direction: string;
  status: string;
  courier_id: string | null;
  deliver_by: string | null;
  address_from: string | null;
  address_to: string | null;
  client_phone: string | null;
  receiver_phone: string | null;
  price: number;
  comment: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  courier_name?: string | null;
  rental_number?: string | null;
  client_name?: string | null;
  items_json?: string | null;
}

function deliveryRowToDomain(row: DeliveryRow): Delivery {
  let items: Delivery["items"] = [];
  try {
    // Что везём — это позиции самой аренды, отдельно их не дублируем:
    // иначе список в доставке разъезжался бы с составом аренды
    items = (JSON.parse(row.items_json || "[]") as InventoryLine[]).map((i) => ({
      name: i.name,
      sku: i.sku ?? "",
      qty: i.qty,
    }));
  } catch {
    items = [];
  }

  return {
    id: row.id,
    number: row.number,
    rentalId: row.rental_id ?? undefined,
    rentalNumber: row.rental_number ?? undefined,
    clientName: row.client_name ?? undefined,
    kind: row.kind as Delivery["kind"],
    direction: row.direction as Delivery["direction"],
    status: row.status as Delivery["status"],
    courierId: row.courier_id ?? undefined,
    courierName: row.courier_name ?? undefined,
    deliverBy: row.deliver_by ?? undefined,
    addressFrom: row.address_from ?? undefined,
    addressTo: row.address_to ?? undefined,
    clientPhone: row.client_phone ?? undefined,
    receiverPhone: row.receiver_phone ?? undefined,
    price: row.price,
    comment: row.comment ?? undefined,
    startedAt: row.started_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items,
  };
}

const DELIVERY_SELECT = `
  SELECT d.*, u.name AS courier_name, r.number AS rental_number, r.items_json, c.name AS client_name
  FROM deliveries d
  LEFT JOIN app_users u ON u.id = d.courier_id
  LEFT JOIN rentals r ON r.id = d.rental_id
  LEFT JOIN clients c ON c.id = r.client_id
`;

/** Сквозной номер доставки — как у аренд, счётчик только растёт */
const nextDeliveryNumber = db.transaction((): number => {
  const row = db.prepare(`SELECT value FROM company_settings WHERE key = 'delivery_counter'`).get() as
    | { value: string }
    | undefined;
  const next = row
    ? Number(row.value) + 1
    : (db.prepare(`SELECT COUNT(*) AS c FROM deliveries`).get() as { c: number }).c + 1;
  db.prepare(
    `INSERT INTO company_settings (key, value) VALUES ('delivery_counter', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(String(next));
  return next;
});

export interface DeliveryFilter {
  status?: Delivery["status"];
  courierId?: string;
  search?: string;
  limit?: number;
}

export function listDeliveries(filter: DeliveryFilter = {}): Delivery[] {
  const where: string[] = [];
  const params: Record<string, unknown> = { limit: filter.limit ?? 300 };

  if (filter.status) {
    where.push("d.status = @status");
    params.status = filter.status;
  }
  if (filter.courierId) {
    where.push("d.courier_id = @courierId");
    params.courierId = filter.courierId;
  }
  if (filter.search) {
    where.push(
      "(LOWER(COALESCE(d.address_to, '')) LIKE @q OR LOWER(COALESCE(d.address_from, '')) LIKE @q OR LOWER(COALESCE(c.name, '')) LIKE @q OR CAST(d.number AS TEXT) LIKE @q)"
    );
    params.q = `%${filter.search.toLowerCase()}%`;
  }

  const rows = db
    .prepare(
      `${DELIVERY_SELECT} ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY COALESCE(d.deliver_by, d.created_at) LIMIT @limit`
    )
    .all(params) as DeliveryRow[];

  return rows.map(deliveryRowToDomain);
}

/** Счётчики для вкладок — одним запросом, а не выборкой всех доставок */
export function deliveryCounts(): Record<Delivery["status"], number> {
  const rows = db.prepare(`SELECT status, COUNT(*) AS c FROM deliveries GROUP BY status`).all() as {
    status: string;
    c: number;
  }[];
  const counts: Record<Delivery["status"], number> = { new: 0, in_progress: 0, done: 0, cancelled: 0 };
  for (const r of rows) counts[r.status as Delivery["status"]] = r.c;
  return counts;
}

export function getDelivery(id: string): Delivery | null {
  const row = db.prepare(`${DELIVERY_SELECT} WHERE d.id = ?`).get(id) as DeliveryRow | undefined;
  return row ? deliveryRowToDomain(row) : null;
}

/** Доставки конкретной аренды — для блока в её карточке */
export function listDeliveriesForRental(rentalId: string): Delivery[] {
  const rows = db.prepare(`${DELIVERY_SELECT} WHERE d.rental_id = ? ORDER BY d.created_at`).all(rentalId) as DeliveryRow[];
  return rows.map(deliveryRowToDomain);
}

export function createDelivery(input: Partial<Delivery>): Delivery {
  const id = newId("dlv");
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO deliveries (id, number, rental_id, kind, direction, status, courier_id, deliver_by,
       address_from, address_to, client_phone, receiver_phone, price, comment, created_at, updated_at)
     VALUES (@id, @number, @rentalId, @kind, @direction, @status, @courierId, @deliverBy,
       @addressFrom, @addressTo, @clientPhone, @receiverPhone, @price, @comment, @createdAt, @updatedAt)`
  ).run({
    id,
    number: nextDeliveryNumber(),
    rentalId: input.rentalId ?? null,
    kind: input.kind ?? "delivery",
    direction: input.direction ?? "to",
    status: input.status ?? "new",
    courierId: input.courierId ?? null,
    deliverBy: input.deliverBy ?? null,
    addressFrom: input.addressFrom ?? null,
    addressTo: input.addressTo ?? null,
    clientPhone: input.clientPhone ?? null,
    receiverPhone: input.receiverPhone ?? null,
    price: input.price ?? 0,
    comment: input.comment ?? null,
    createdAt: now,
    updatedAt: now,
  });

  const created = getDelivery(id)!;
  logActivity(`Создана доставка №${created.number}`);
  if (input.rentalId) {
    logRentalEvent({
      rentalId: input.rentalId,
      type: "status",
      title: "Назначил доставку",
      details: `№${created.number}${created.addressTo ? ` → ${created.addressTo}` : ""}`,
    });
  }
  return created;
}

export function updateDelivery(id: string, patch: Partial<Delivery>): Delivery | null {
  const existing = getDelivery(id);
  if (!existing) return null;

  const now = new Date().toISOString();
  const status = patch.status ?? existing.status;

  // Отметки времени ставятся один раз и сбрасываются при откате статуса назад,
  // иначе по ним нельзя было бы считать реальную длительность
  const startedAt = status === "new" ? null : existing.startedAt ?? now;
  const completedAt = status === "done" ? existing.completedAt ?? now : null;

  db.prepare(
    `UPDATE deliveries SET kind=@kind, direction=@direction, status=@status, courier_id=@courierId,
     deliver_by=@deliverBy, address_from=@addressFrom, address_to=@addressTo, client_phone=@clientPhone,
     receiver_phone=@receiverPhone, price=@price, comment=@comment, started_at=@startedAt,
     completed_at=@completedAt, updated_at=@updatedAt WHERE id=@id`
  ).run({
    id,
    kind: patch.kind ?? existing.kind,
    direction: patch.direction ?? existing.direction,
    status,
    courierId: patch.courierId !== undefined ? patch.courierId || null : existing.courierId ?? null,
    deliverBy: patch.deliverBy !== undefined ? patch.deliverBy || null : existing.deliverBy ?? null,
    addressFrom: patch.addressFrom !== undefined ? patch.addressFrom || null : existing.addressFrom ?? null,
    addressTo: patch.addressTo !== undefined ? patch.addressTo || null : existing.addressTo ?? null,
    clientPhone: patch.clientPhone !== undefined ? patch.clientPhone || null : existing.clientPhone ?? null,
    receiverPhone: patch.receiverPhone !== undefined ? patch.receiverPhone || null : existing.receiverPhone ?? null,
    price: patch.price ?? existing.price,
    comment: patch.comment !== undefined ? patch.comment || null : existing.comment ?? null,
    startedAt,
    completedAt,
    updatedAt: now,
  });

  const updated = getDelivery(id)!;
  if (existing.status !== status && updated.rentalId) {
    const titles: Record<string, string> = {
      new: "Вернул доставку в запросы",
      in_progress: "Доставка в пути",
      done: "Доставка выполнена",
      cancelled: "Отменил доставку",
    };
    logRentalEvent({ rentalId: updated.rentalId, type: "status", title: titles[status] ?? "Доставка", details: `№${updated.number}` });
  }
  return updated;
}

export function deleteDelivery(id: string) {
  db.prepare(`DELETE FROM deliveries WHERE id = ?`).run(id);
}

/** Сводка для кнопки «Аналитика» на странице доставок */
export function deliveryStats(fromIso: string | null) {
  const params = { from: fromIso };
  const base = `FROM deliveries WHERE (@from IS NULL OR created_at >= @from)`;

  const total = (db.prepare(`SELECT COUNT(*) AS c ${base}`).get(params) as { c: number }).c;
  const done = (db.prepare(`SELECT COUNT(*) AS c ${base} AND status = 'done'`).get(params) as { c: number }).c;
  const inProgress = (db.prepare(`SELECT COUNT(*) AS c ${base} AND status = 'in_progress'`).get(params) as { c: number }).c;
  const revenue = (db.prepare(`SELECT COALESCE(SUM(price), 0) AS v ${base} AND status = 'done'`).get(params) as { v: number }).v;

  // Просрочка: срок в прошлом, а доставка ещё не выполнена
  const overdue = (
    db
      .prepare(`SELECT COUNT(*) AS c ${base} AND status IN ('new','in_progress') AND deliver_by IS NOT NULL AND deliver_by < @now`)
      .get({ ...params, now: new Date().toISOString() }) as { c: number }
  ).c;

  // Среднее время от взятия в работу до завершения, часы
  const avg = (
    db
      .prepare(
        `SELECT AVG((julianday(completed_at) - julianday(started_at)) * 24) AS v ${base}
         AND status = 'done' AND started_at IS NOT NULL AND completed_at IS NOT NULL`
      )
      .get(params) as { v: number | null }
  ).v;

  const byCourier = db
    .prepare(
      `SELECT COALESCE(u.name, 'Не назначен') AS courier,
              COUNT(*) AS total,
              SUM(CASE WHEN d.status = 'done' THEN 1 ELSE 0 END) AS done,
              COALESCE(SUM(CASE WHEN d.status = 'done' THEN d.price ELSE 0 END), 0) AS revenue
       FROM deliveries d
       LEFT JOIN app_users u ON u.id = d.courier_id
       WHERE (@from IS NULL OR d.created_at >= @from)
       GROUP BY COALESCE(u.name, 'Не назначен')
       ORDER BY done DESC, total DESC`
    )
    .all(params) as { courier: string; total: number; done: number; revenue: number }[];

  return {
    total,
    done,
    inProgress,
    overdue,
    revenue,
    avgHours: avg === null ? null : Math.round(avg * 10) / 10,
    byCourier,
  };
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
  is_owner: number;
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
    isOwner: row.is_owner === 1,
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
  position?: string; isActive?: boolean; permissions?: Permission[]; isAdmin?: boolean;
}): Promise<AppUser> {
  const id = newId("usr");
  const now = new Date().toISOString();
  const hash = await bcrypt.hash(input.password, 10);
  db.prepare(
    `INSERT INTO app_users (id, login, password_hash, name, position, is_admin, is_owner, is_active, permissions_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`
  ).run(
    id,
    input.login,
    hash,
    input.name,
    input.position ?? null,
    input.isAdmin ? 1 : 0,
    input.isActive !== false ? 1 : 0,
    // Галочки храним всегда: при полном доступе они не действуют, но если роль
    // администратора заберут — человек вернётся к своим прежним правам
    JSON.stringify(input.permissions ?? []),
    now
  );
  return getUser(id)!;
}

export async function updateUser(id: string, patch: {
  name?: string; position?: string; isActive?: boolean;
  permissions?: Permission[]; password?: string; isAdmin?: boolean;
}): Promise<AppUser | null> {
  const existing = db.prepare(`SELECT * FROM app_users WHERE id = ?`).get(id) as UserRow | undefined;
  if (!existing) return null;

  // Запрет жил только в интерфейсе: через API главного администратора можно было
  // заблокировать и потерять доступ ко всей системе
  if (existing.is_owner && patch.isActive === false) {
    throw httpError(403, "Главного администратора нельзя заблокировать");
  }
  if (existing.is_owner && patch.isAdmin === false) {
    throw httpError(403, "У главного администратора нельзя забрать полный доступ");
  }

  const passwordHash = patch.password ? await bcrypt.hash(patch.password, 10) : existing.password_hash;
  const isAdmin = patch.isAdmin !== undefined ? patch.isAdmin : existing.is_admin === 1;

  db.prepare(
    `UPDATE app_users SET name=?, position=?, is_admin=?, is_active=?, permissions_json=?, password_hash=? WHERE id=?`
  ).run(
    patch.name ?? existing.name,
    patch.position !== undefined ? patch.position : existing.position,
    isAdmin ? 1 : 0,
    patch.isActive !== undefined ? (patch.isActive ? 1 : 0) : existing.is_active,
    JSON.stringify(patch.permissions ?? JSON.parse(existing.permissions_json)),
    passwordHash,
    id
  );
  return getUser(id);
}

export function deleteUser(id: string) {
  // Удалять нельзя только владельца: обычного администратора разжаловать и убрать можно
  const row = db.prepare(`SELECT is_owner FROM app_users WHERE id = ?`).get(id) as { is_owner: number } | undefined;
  if (row?.is_owner) throw httpError(403, "Главного администратора нельзя удалить");
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
