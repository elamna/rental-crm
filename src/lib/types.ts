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

/** «shop» — товар из магазина: продаётся навсегда, срок аренды на него не влияет */
export type LineCategory = "product" | "kit" | "service" | "shop";

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
  /** Свободная пометка менеджера */
  notes?: string;
  /** Звёзды 1–5. Считаются сами по истории аренд, вручную не выставляются */
  rating?: number;
  /** Из чего сложился рейтинг — показываем в подсказке, чтобы он не был магией */
  ratingBreakdown?: ClientRatingBreakdown;
  // Derived / accumulated (computed from real rentals, 0 until rentals exist)
  totalRentals: number;
  totalSpent: number;
  repeatRentals: number;
  overdueCount: number;
  lastRentalDate?: string;
  createdAt: string;
  blacklisted?: boolean;
}

/** Расшифровка рейтинга: три составляющие, каждая 0–100 % */
export interface ClientRatingBreakdown {
  /** Как часто обращается: число завершённых аренд */
  loyalty: number;
  /** Платёжная дисциплина: доля полностью оплаченных аренд */
  payment: number;
  /** Возвраты в срок: доля аренд, закрытых не позже конца срока */
  punctuality: number;
  /** Сколько аренд участвовало в расчёте */
  rentals: number;
  /** Текущий долг по всем арендам, ₸ */
  debt: number;
  /** Сколько раз возвращали с опозданием */
  lateReturns: number;
}

/** Отчёт об импорте: сколько легло, сколько пропущено и по каким причинам */
export interface ImportReport {
  added: number;
  skipped: number;
  /** Причина → сколько строк */
  reasons: Record<string, number>;
  /**
   * Артикулы, из-за которых строки не легли: они уже заняты в базе или
   * повторяются внутри самого файла. Нужны, чтобы показать их владельцу —
   * без списка «пропущено 13» невозможно понять, что именно потерялось.
   */
  duplicateSkus?: string[];
}

/** Чем платят: наличные, Kaspi (QR или перевод) и безнал от компаний */
export type PaymentMethod = "cash" | "kaspi" | "company";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Наличные",
  kaspi: "Kaspi",
  company: "От компаний",
};

export interface RentalPayment {
  id: string;
  rentalId: string;
  amount: number;
  method: PaymentMethod;
  createdAt: string;
  /** Кто принял деньги — в чеке это главный вопрос после суммы */
  createdBy?: string;
}

/**
 * Некомплект при возврате: пылесос вернули, а трубку «потеряли». Аренду это
 * не блокирует — вещь уже у нас, — но вопрос остаётся открытым, пока деталь
 * не вернут или не оплатят.
 */
export interface ReturnShortage {
  id: string;
  rentalId: string;
  inventoryItemId?: string;
  itemName: string;
  /** Чего именно не хватает — со слов приёмщика */
  note?: string;
  resolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  createdAt: string;
  createdBy?: string;
  /** Заполняется в списке: по какой аренде и кто клиент */
  rentalNumber?: string;
  clientId?: string;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  clientType?: ClientType;
  clientBlacklisted?: boolean;
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
  // createdAt нужен финансам: без него операция попадала в отчёт на дату создания аренды
  penalties?: { reason: string; amount: number; createdAt?: string }[];
  expenses?: { type: string; amount: number; description?: string; createdAt?: string }[];
  documents?: string[];
  notes?: string[];
  /** Момент постановки на паузу; null — аренда идёт */
  pausedAt?: string;
  /** Когда товар фактически вернули: по нему считается пунктуальность клиента */
  returnedAt?: string;
  /** Когда последний раз меняли оплату — по этой дате финансы относят платёж к периоду */
  paidAt?: string;
  autoPenaltyEnabled?: boolean;
  penaltyRatePerHour?: number;
  createdAt?: string;
  updatedAt?: string;
}

/** servicing и in_progress — параллельные ветки: обслуживание и ремонт идут по-разному */
export type WorkshopStatus = "new" | "servicing" | "in_progress" | "done" | "archived";
/** service — плановое ТО, maintenance — диагностика после возврата, repair — ремонт */
export type WorkshopReason = "service" | "maintenance" | "repair";

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
  /** Подписан ли клиентом — отмечается сразу после печати */
  signed: boolean;
  signedAt?: string;
  /** Кто отметил подписание */
  signedBy?: string;
  /** Пока способ один — «Ручное подписание», но поле оставлено под ЭЦП */
  signMethod?: string;
  /** Заполняется только в общем реестре документов */
  rentalNumber?: string;
  clientName?: string;
  clientPhone?: string;
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
  | "delivery.view" | "delivery.edit"
  | "shop.view" | "shop.edit"
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
  "delivery.view", "delivery.edit",
  "shop.view", "shop.edit",
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
  "delivery.view": "Доставка — просмотр",
  "delivery.edit": "Доставка — создание и выполнение",
  "shop.view": "Магазин — просмотр",
  "shop.edit": "Магазин — приход и продажа",
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
  /** Полный доступ ко всем разделам. Выдаётся главным администратором */
  isAdmin: boolean;
  /** Создатель системы: его нельзя удалить, заблокировать или разжаловать.
   *  Только он раздаёт и забирает права администратора */
  isOwner: boolean;
  isActive: boolean;
  permissions: Permission[];
  createdAt: string;
}

export interface SessionUser {
  id: string;
  login: string;
  name: string;
  isAdmin: boolean;
  isOwner: boolean;
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

/**
 * Товар магазина: продаётся безвозвратно, как хлеб в магазине. С каталогом
 * аренды не связан ничем — свой инвентарный и серийный номер, свой остаток.
 */
export interface ShopProduct {
  id: string;
  name: string;
  /** Инвентарный номер — уникален внутри магазина */
  sku: string;
  /** Серийный номер производителя */
  serialNumber?: string;
  category?: string;
  /** Цена продажи, ₸ */
  price: number;
  /** Себестоимость — нужна финансам, чтобы видеть наценку */
  purchaseCost?: number;
  /** Остаток на складе, шт. */
  qty: number;
  photoUrl?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
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

/**
 * Источник автоматической задачи. Такие задачи система ставит и закрывает сама:
 * долг оплатили — задача закрылась, аренду вернули — закрылась.
 */
export type TaskSource = "rental_overdue" | "rental_debt" | "shortage";

export const TASK_SOURCE_LABELS: Record<TaskSource, string> = {
  rental_overdue: "Просрочка",
  rental_debt: "Долг",
  shortage: "Некомплект",
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
  /** Откуда задача взялась, если её поставила система, а не человек */
  sourceKind?: TaskSource;
  /** Объект, из-за которого задача появилась: аренда или запись о некомплекте */
  sourceId?: string;
  /** Куда вести по клику: /rentals/<id>, /shortages и т.п. */
  sourceUrl?: string;
  /** Кому ещё открыт просмотр, кроме исполнителя и постановщика */
  visibleTo: string[];
  createdAt: string;
  updatedAt: string;
}

// ---------- Проверка в реестре должников ----------

/**
 * Одно исполнительное производство — строка реестра АИС ОИП как её видит
 * менеджер: кто должник, кто взыскивает, сколько и запрещён ли выезд.
 */
export interface DebtCase {
  /** ФИО или наименование должника — в реестре оно своё, не как у нас в карточке */
  debtor?: string;
  /** Дата возбуждения исполнительного производства */
  startedAt?: string;
  /** Судебный исполнитель и его орган: «ЧСИ Атырауской области, Абуева Б.» */
  officer?: string;
  /** Кто выдал исполнительный документ: суд, нотариальная палата */
  issuedBy?: string;
  /** В чью пользу взыскивают */
  claimant?: string;
  amount?: number;
  travelBan?: boolean;
  travelBanFrom?: string;
}

/**
 * Результат проверки клиента в едином реестре должников по исполнительным
 * производствам (портал открытых данных, владелец — Минюст РК).
 */
export interface DebtCheck {
  id: string;
  clientId?: string;
  /** ИИН или БИН, по которому искали */
  identifier: string;
  kind: "iin" | "bin";
  /** clean — в реестре нет, debtor — есть, unknown — портал ответил непонятно */
  status: "clean" | "debtor" | "unknown";
  /** Сколько исполнительных производств нашлось */
  cases: number;
  /** Общая сумма по производствам, ₸ */
  amount: number;
  /** Ограничение на выезд из РК */
  travelBan: boolean;
  /** Сами производства — по ним показывается таблица */
  records?: DebtCase[];
  /** Данные внесены руками, а не получены из реестра */
  manual?: boolean;
  checkedAt: string;
  checkedBy?: string;
}

// ---------- Напоминания клиентам ----------

/** Повод написать клиенту. Список закрытый: по нему же настраиваются шаблоны */
export type ReminderKind =
  | "return_tomorrow"
  | "return_soon"
  | "overdue"
  | "debt"
  | "lead_silent"
  | "shortage";

export const REMINDER_KIND_LABELS: Record<ReminderKind, string> = {
  return_tomorrow: "Возврат завтра",
  return_soon: "Возврат через 3 часа",
  overdue: "Просрочка",
  debt: "Долг",
  lead_silent: "Звонил, не дошёл",
  shortage: "Некомплект",
};

/** Готовая строка «кому и что написать» */
export interface ReminderItem {
  kind: ReminderKind;
  /** Аренда, заявка или запись о некомплекте, из-за которой напоминание появилось */
  targetId: string;
  /** Куда вести по клику */
  url: string;
  clientId?: string;
  clientName: string;
  phone?: string;
  /** Короткое пояснение: «аренда №9001 · виброплита» */
  subtitle: string;
  /** Срок, к которому привязан повод */
  dueAt?: string;
  /** Готовый текст сообщения — остаётся только отправить */
  message: string;
  /** Когда по этому же поводу писали в прошлый раз */
  lastSentAt?: string;
}

export type ReminderTemplates = Record<ReminderKind, string>;

/** Строка сводки «Люди»: чем человек занят прямо сейчас */
export interface TaskWorkloadRow {
  userId: string;
  userName: string;
  todo: number;
  inProgress: number;
  review: number;
  /** Активные задачи, у которых срок уже прошёл */
  overdue: number;
  /** Закрыто за последние 7 дней */
  doneWeek: number;
  /** Среднее время закрытия за неделю, часы */
  avgHours: number | null;
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

/**
 * Сводка воронки за день — то, что вечером отправляют владельцу в переписку:
 * сколько обратилось, сколько дошло до аренды, кто отказался и что просили,
 * но не смогли дать.
 */
export interface FunnelDaySummary {
  date: string;
  /** Сколько заявок завели за день — это и есть все обращения */
  calls: number;
  /** Из них закрыто успешно: клиент взял инструмент */
  won: number;
  /** Из них отказались */
  lost: number;
  /** Открытые заявки, которых ждём: завтра, до конца недели, дальше */
  tomorrow: number;
  thisWeek: number;
  later: number;
  /** Спрос, который не смогли закрыть: инструмента не было */
  unavailable: number;
  /** Иногородние заявки в работе */
  otherCity: number;
  /** Что именно просили, но не смогли дать */
  unavailableItems: string[];
}

/** Возражения клиента — то, что менеджер отмечает галочкой прямо в разговоре */
export type LeadConcern = "expensive" | "far" | "delivery";

export const LEAD_CONCERN_LABELS: Record<LeadConcern, string> = {
  expensive: "Дорого",
  far: "Далеко",
  delivery: "Дорогая доставка",
};

/** Настроение клиента: пять лиц вместо шкалы — менеджеру так быстрее */
export const LEAD_MOODS = ["😡", "😏", "😌", "🤗", "😍"];

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
  /** Клиент не из города: дату «когда нужен инструмент» с него не требуем */
  otherCity?: boolean;
  /** Будущий клиент: инструмент нужен когда-нибудь потом, точной даты нет */
  future?: boolean;
  clientType?: ClientType;
  /** Что смущает клиента: дорого, далеко, дорогая доставка */
  concerns?: LeadConcern[];
  /** Настроение клиента после разговора, 1 (злой) – 5 (в восторге) */
  mood?: number;
  /** Когда клиент выехал: от этого времени на карточке тикает таймер */
  onTheWayAt?: string;
  /** Сколько минут дали на дорогу: 30 или 60 — менеджер выбирает при отметке */
  onTheWayMinutes?: number;
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

// ---------- Доставка ----------

/** Везём клиенту или забираем у него */
export type DeliveryKind = "delivery" | "pickup";
/** Куда едем: туда, обратно или туда и обратно одной ходкой */
export type DeliveryDirection = "to" | "back" | "both";
export type DeliveryStatus = "new" | "in_progress" | "done" | "cancelled";

export const DELIVERY_KIND_LABELS: Record<DeliveryKind, string> = {
  delivery: "Доставка",
  pickup: "Вывоз",
};

export const DELIVERY_DIRECTION_LABELS: Record<DeliveryDirection, string> = {
  to: "ТУДА",
  back: "ОБРАТНО",
  both: "ТУДА ОБРАТНО",
};

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  new: "Новые запросы",
  in_progress: "В процессе",
  done: "Завершено",
  cancelled: "Отменено",
};

export interface Delivery {
  id: string;
  /** Сквозной номер: №22 */
  number: number;
  rentalId?: string;
  /** Номер аренды для карточки, подставляется при чтении */
  rentalNumber?: string;
  clientName?: string;
  kind: DeliveryKind;
  direction: DeliveryDirection;
  status: DeliveryStatus;
  /** Кто везёт */
  courierId?: string;
  courierName?: string;
  /** Доставить до — по этому сроку считается просрочка */
  deliverBy?: string;
  addressFrom?: string;
  addressTo?: string;
  clientPhone?: string;
  receiverPhone?: string;
  price: number;
  comment?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  /** Что везём — берётся из позиций аренды */
  items: { name: string; sku: string; qty: number }[];
}
