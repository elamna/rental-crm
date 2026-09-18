import type { ClientType } from "./types";

/**
 * Отбор «физлица / юрлица» — один на всю систему.
 *
 * Прокат работает с двумя разными мирами: частник берёт перфоратор на выходные,
 * компания — леса на объект на месяц, с договором и счётом. Смотреть их вместе
 * часто бессмысленно, поэтому переключатель стоит на каждом списке и в отчётах,
 * и везде он значит одно и то же.
 */
export type ClientTypeFilter = "all" | ClientType;

export const CLIENT_TYPE_FILTER_OPTIONS: { key: ClientTypeFilter; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "individual", label: "Физлица" },
  { key: "company", label: "Юрлица" },
];

/**
 * Подходит ли запись под отбор. Тип не указан — считаем физлицом: так
 * заводится любая карточка по умолчанию, и старые заявки воронки без типа —
 * почти всегда частники.
 */
export function matchesClientType(type: ClientType | null | undefined, filter: ClientTypeFilter) {
  if (filter === "all") return true;
  return (type ?? "individual") === filter;
}

/** Значение из адреса запроса; всё незнакомое — «все» */
export function parseClientTypeFilter(value: string | null | undefined): ClientTypeFilter {
  return value === "individual" || value === "company" ? value : "all";
}

/**
 * Условие SQL для отбора по типу клиента. `column` — выражение с типом
 * (например `c.type`); пустой тип приравнен к физлицу, как и в интерфейсе.
 * Возвращает пустую строку, если отбирать нечего.
 */
export function clientTypeSql(column: string, filter: ClientTypeFilter) {
  if (filter === "all") return "";
  return filter === "company" ? `${column} = 'company'` : `COALESCE(${column}, 'individual') <> 'company'`;
}

/**
 * Хвост условия «клиент нужного типа» для колонки с id клиента — там, где
 * к таблице клиентов не делают JOIN. Пустая строка, если отбирать нечего.
 */
export function clientIdOfType(column: string, filter: ClientTypeFilter) {
  const sql = clientTypeSql("type", filter);
  return sql ? ` AND ${column} IN (SELECT id FROM clients WHERE ${sql})` : "";
}

/** То же для колонки с id аренды: платежи, доставки, некомплект */
export function rentalIdOfType(column: string, filter: ClientTypeFilter) {
  const sql = clientTypeSql("tc.type", filter);
  return sql
    ? ` AND ${column} IN (SELECT tr.id FROM rentals tr LEFT JOIN clients tc ON tc.id = tr.client_id WHERE ${sql})`
    : "";
}
