// Справочные списки для форм. Никаких фейковых клиентов, аренд или выручки —
// всё реальные данные, которые вводит пользователь, хранятся в src/lib/store.ts.

export const branches = ["Атырау", "Астана"];

export const acquisitionChannels = [
  "Instagram",
  "WhatsApp",
  "Рекомендация",
  "Google / поиск",
  "Постоянный клиент",
  "Другое",
];

export const clientTypeLabels = {
  individual: "Физ. лицо",
  company: "Юр. лицо",
} as const;

export const ratingOptions = [1, 2, 3, 4, 5];

export const rentalPeriods: { value: "hourly" | "daily" | "weekly" | "monthly"; label: string }[] = [
  { value: "hourly", label: "Почасовая" },
  { value: "daily", label: "Посуточная" },
  { value: "weekly", label: "Понедельная" },
  { value: "monthly", label: "Помесячная" },
];

export const depositTypeLabels = {
  money: "Деньги",
  document: "Документ",
  equipment: "Техника",
  other: "Другое",
} as const;

export const inventoryCategories = [
  "Электроинструмент",
  "Бензоинструмент",
  "Сварочное оборудование",
  "Измерительный инструмент",
  "Строительная техника",
  "Генераторы",
  "Прочее",
];

export const inventoryStatusLabels = {
  available: "Свободен",
  rented: "В аренде",
  maintenance: "На обслуживании",
  repair: "Требует ремонта",
  stolen: "Украден",
  written_off: "Списан",
} as const;
