export type InventoryStatus = "available" | "rented" | "maintenance" | "repair" | "stolen" | "written_off";

export interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  category: string;
  subcategory?: string;
  serialNumber?: string;
  purchasePrice?: number;
  rentalPricePerDay: number;
  status: InventoryStatus;
  branch: string;
  photoUrl?: string;
  notes?: string;
  createdAt: string;
}

export type RentalStatus =
  | "request"
  | "booked"
  | "active"
  | "completed"
  | "overdue"
  | "stolen"
  | "cancelled";

export type PaymentStatus = "paid" | "pending" | "overdue" | "partial";

export type LineCategory = "product" | "kit" | "service";

export interface InventoryLine {
  id: string;
  name: string;
  sku: string;
  qty: number;
  pricePerDay: number;
  category?: LineCategory;
  inventoryItemId?: string;
  flagged?: boolean;
}

export interface Employee {
  id: string;
  name: string;
  initials: string;
  role: string;
}

export type ClientType = "individual" | "company";

export interface Client {
  id: string;
  name: string; // ФИО / Название компании
  type: ClientType;
  phone: string;
  email?: string;
  photoUrl?: string;
  // Документ клиента (физ. лицо)
  iin?: string;
  birthDate?: string;
  documentNumber?: string;
  documentIssuedBy?: string;
  documentIssuedAt?: string;
  documentExpiresAt?: string;
  // Реквизиты (юр. лицо)
  bin?: string;
  legalAddress?: string;
  companyDirector?: string;
  bankAccount?: string; // ИИК
  bank?: string;
  bik?: string;
  // Дополнительно
  acquisitionChannel?: string;
  discount?: number;
  rating?: number; // 1-5, undefined = not rated
  // Derived / accumulated (computed from real rentals, 0 until rentals exist)
  totalRentals: number;
  totalSpent: number;
  repeatRentals: number;
  overdueCount: number;
  lastRentalDate?: string;
  createdAt: string;
  blacklisted?: boolean;
}

export type RentalPeriod = "hourly" | "daily" | "weekly" | "monthly";

export interface Rental {
  id: string;
  number: string;
  status: RentalStatus;
  paymentStatus: PaymentStatus;
  branch: string;
  startDate: string;
  endDate: string;
  startAt?: string; // ISO datetime, source of truth for startDate display
  endAt?: string; // ISO datetime, source of truth for endDate display
  rentalPeriod?: RentalPeriod;
  client: Client;
  total: number;
  paid: number;
  items: InventoryLine[];
  bookedBy: Employee;
  issuedBy?: Employee;
  comment?: string;
  delivery: boolean;
  deposit?: {
    type: "money" | "document" | "equipment" | "other";
    amount?: number;
    returned: boolean;
  };
  penalties?: { reason: string; amount: number }[];
  expenses?: { type: string; amount: number }[];
  documents?: string[];
  notes?: string[];
  /** Момент постановки на паузу; null — аренда идёт */
  pausedAt?: string;
  autoPenaltyEnabled?: boolean;
  penaltyRatePerHour?: number;
  createdAt?: string;
  updatedAt?: string;
}

export type WorkshopStatus = "new" | "in_progress" | "done" | "archived";
export type WorkshopReason = "maintenance" | "repair";

export interface WorkshopLine {
  id: string;
  type: "part" | "service";
  name: string;
  qty: number;
  price: number;
}

export interface WorkshopTicket {
  id: string;
  number: string;
  status: WorkshopStatus;
  reason: WorkshopReason;
  inventoryItemId: string;
  inventoryItem?: InventoryItem;
  title: string;
  description?: string;
  lines: WorkshopLine[];
  total: number;
  sourceRentalId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  activeRentals: number;
  freeTools: number;
  overdueRentals: number;
  expectedReturns: number;
  revenueToday: number;
  revenueMonth: number;
}

// ---------- Документы ----------

export interface DocumentTemplate {
  id: string;
  name: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface RentalDocument {
  id: string;
  rentalId: string;
  templateId?: string;
  name: string;
  body: string;
  createdAt: string;
}

// ---------- Auth & RBAC ----------

export type Permission =
  | "dashboard.view"
  | "rentals.view" | "rentals.edit"
  | "catalog.view" | "catalog.edit"
  | "clients.view" | "clients.edit"
  | "workshop.view" | "workshop.edit"
  | "documents.view" | "documents.edit"
  | "blacklist.view"
  | "tasks.view" | "tasks.manage"
  | "leads.view" | "leads.edit"
  | "analytics.view"
  | "finance.view"
  | "settings.view"
  | "users.view" | "users.edit";

export const ALL_PERMISSIONS: Permission[] = [
  "dashboard.view",
  "rentals.view", "rentals.edit",
  "catalog.view", "catalog.edit",
  "clients.view", "clients.edit",
  "workshop.view", "workshop.edit",
  "documents.view", "documents.edit",
  "blacklist.view",
  "tasks.view", "tasks.manage",
  "leads.view", "leads.edit",
  "analytics.view",
  "finance.view",
  "settings.view",
  "users.view", "users.edit",
];

export const PERMISSION_LABELS: Record<Permission, string> = {
  "dashboard.view": "Главная — просмотр",
  "rentals.view": "Аренда — просмотр",
  "rentals.edit": "Аренда — редактирование",
  "catalog.view": "Каталог — просмотр",
  "catalog.edit": "Каталог — редактирование",
  "clients.view": "Клиенты — просмотр",
  "clients.edit": "Клиенты — редактирование",
  "workshop.view": "Мастерская — просмотр",
  "workshop.edit": "Мастерская — редактирование",
  "documents.view": "Документы — просмотр",
  "documents.edit": "Документы — редактирование",
  "blacklist.view": "Чёрный список — просмотр",
  "tasks.view": "Темп — свои задачи",
  "tasks.manage": "Темп — все задачи и KPI",
  "leads.view": "Воронка — просмотр заявок",
  "leads.edit": "Воронка — создание и изменение",
  "analytics.view": "Аналитика — просмотр",
  "finance.view": "Финансы — просмотр",
  "settings.view": "Настройки — просмотр",
  "users.view": "Пользователи — просмотр",
  "users.edit": "Пользователи — редактирование",
};

export interface AppUser {
  id: string;
  login: string;
  name: string;
  position?: string;
  isAdmin: boolean; // главный администратор — всегда полный доступ
  isActive: boolean;
  permissions: Permission[];
  createdAt: string;
}

export interface SessionUser {
  id: string;
  login: string;
  name: string;
  isAdmin: boolean;
  permissions: Permission[];
}

// ---------- Каталог: комплекты, услуги, инвентаризация ----------

/** Позиция состава комплекта. inventoryName — привязка к продукту каталога по названию. */
export interface KitLine {
  id: string;
  name: string;
  qty: number;
  price: number;
  inventoryName?: string;
}

export interface Kit {
  id: string;
  name: string;
  category: string;
  photoUrl?: string;
  /** Цена аренды комплекта за сутки */
  price: number;
  lines: KitLine[];
  notes?: string;
  createdAt: string;
}

export type ServiceTariffType = "day" | "once" | "period";

export interface ServiceTariff {
  type: ServiceTariffType;
  price: number;
}

export interface Service {
  id: string;
  name: string;
  category?: string;
  tariffs: ServiceTariff[];
  notes?: string;
  createdAt: string;
}

export type InventoryCondition = "ok" | "broken";

/** Запись инвентаризации: кто, когда и в каком состоянии принял единицу инвентаря. */
export interface InventoryCheck {
  id: string;
  inventoryItemId: string;
  condition: InventoryCondition;
  checkedByName: string;
  comment?: string;
  createdAt: string;
}

// ---------- Темп: задачи сотрудников и KPI ----------

export type TaskStatus = "todo" | "in_progress" | "review" | "done" | "cancelled";
export type TaskPriority = "low" | "normal" | "high";

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "Новая",
  in_progress: "В работе",
  review: "На проверке",
  done: "Выполнена",
  cancelled: "Отменена",
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Низкий",
  normal: "Обычный",
  high: "Высокий",
};

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId?: string;
  assigneeName?: string;
  createdById?: string;
  createdByName?: string;
  dueAt?: string;
  doneAt?: string;
  /** Вес задачи в KPI: мелкая — 1, крупная — 3 и т.д. */
  points: number;
  /** Кому ещё открыт просмотр, кроме исполнителя и постановщика */
  visibleTo: string[];
  createdAt: string;
  updatedAt: string;
}

/** Строка KPI по сотруднику за период */
export interface TaskKpiRow {
  userId: string;
  userName: string;
  assigned: number;
  done: number;
  onTime: number;
  late: number;
  points: number;
  /** Среднее время выполнения, часы */
  avgHours: number | null;
  /** Сводная оценка 0–100: доля выполненных и доля сделанных в срок */
  score: number;
}

// ---------- Воронка: заявки ----------

/** Заявка живёт на доске, пока открыта; закрытая уходит в выигранные или проигранные */
export type LeadStatus = "open" | "won" | "lost";

export interface Lead {
  id: string;
  /** Порядковый номер для менеджеров: №4171 */
  number: number;
  /** Что нужно клиенту — заголовок карточки */
  title: string;
  clientName?: string;
  phone?: string;
  /** Сумма сделки */
  amount: number;
  managerId?: string;
  managerName?: string;
  /** Канал привлечения: Whatsapp, Сарафанка и т.д. */
  source?: string;
  /** Когда инструмент нужен клиенту — по этой дате карточка сама встаёт в колонку */
  neededAt?: string;
  /** Инструмента нет в наличии — карточка стоит в отдельной колонке независимо от даты */
  unavailable: boolean;
  status: LeadStatus;
  notes?: string;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ---------- История аренды и паузы ----------

export type RentalEventType =
  | "created" | "status" | "payment" | "total" | "items" | "dates"
  | "paused" | "resumed" | "revert";

/**
 * Запись в истории аренды. before хранит значения полей ДО изменения —
 * по ним делается откат ошибочного действия.
 */
export interface RentalEvent {
  id: string;
  rentalId: string;
  type: RentalEventType;
  /** Человекочитаемо: «Выдал инвентарь» */
  title: string;
  /** Подробности: список товаров, сумма и т.п. */
  details?: string;
  actorName?: string;
  before?: Record<string, unknown>;
  /** Событие уже откатили — повторно откатить нельзя */
  reverted: boolean;
  createdAt: string;
}

export interface RentalPause {
  id: string;
  rentalId: string;
  startedAt: string;
  /** null — пауза ещё идёт */
  endedAt?: string;
  reason?: string;
  actorName?: string;
  /** Длительность в часах, считается при чтении */
  hours: number;
}
