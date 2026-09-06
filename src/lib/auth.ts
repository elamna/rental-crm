import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions } from "./session";
import { Permission, SessionUser } from "./types";
import { getUser } from "./repo";

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<{ user?: SessionUser }>(cookieStore, sessionOptions);
}

/**
 * Кто сейчас в системе. Роль и права перечитываются из базы, а не берутся из
 * cookie: иначе выданный руководителю админ-доступ (или наоборот блокировка)
 * начинал бы действовать только после перезахода.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await getSession();
  const stored = session.user;
  if (!stored) return null;

  const fresh = getUser(stored.id);
  // Пользователя удалили или заблокировали — сессия больше не действует
  if (!fresh || !fresh.isActive) return null;

  return {
    id: fresh.id,
    login: fresh.login,
    name: fresh.name,
    isAdmin: fresh.isAdmin,
    isOwner: fresh.isOwner,
    permissions: fresh.permissions,
  };
}

export function hasPermission(user: SessionUser, permission: Permission): boolean {
  if (user.isAdmin) return true;
  return user.permissions.includes(permission);
}

export function hasAnyPermission(user: SessionUser, permissions: Permission[]): boolean {
  if (user.isAdmin) return true;
  return permissions.some((p) => user.permissions.includes(p));
}

/** Бросает 401/403 для API роутов */
export async function requireAuth(permission?: Permission): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new ApiError(401, "Не авторизован");
  if (permission && !hasPermission(user, permission)) throw new ApiError(403, "Нет доступа");
  return user;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function apiUnauthorized(message = "Не авторизован") {
  return Response.json({ error: message }, { status: 401 });
}

export function apiForbidden(message = "Нет доступа") {
  return Response.json({ error: message }, { status: 403 });
}

/**
 * Единый ответ на ошибку API. ApiError отдаёт свой код (400/401/403),
 * всё остальное — 500. Раньше роуты падали 500 даже на неверных данных.
 */
export function apiError(e: unknown) {
  const err = e as { status?: number; message?: string };
  const status = err?.status ?? 500;
  if (status === 500) console.error("API error:", e);

  // «FOREIGN KEY constraint failed» ничего не говорит менеджеру: переводим
  // на человеческий и отдаём 409 — это не поломка сервера, а связанные данные
  const raw = err?.message ?? "";
  if (/FOREIGN KEY constraint failed/i.test(raw)) {
    return Response.json(
      { error: "Запись связана с другими данными и не может быть удалена. Сообщите администратору, если это повторится." },
      { status: 409 }
    );
  }

  return Response.json({ error: raw || "Внутренняя ошибка сервера" }, { status });
}

/** Обязательное текстовое поле */
export function required(value: unknown, field: string): string {
  const s = typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
  if (!s) throw new ApiError(400, `Укажите ${field}`);
  return s;
}

/** Число, которое не может быть отрицательным (цены, оплаты, суммы) */
export function nonNegative(value: unknown, field: string): number {
  if (value === undefined || value === null || value === "") return 0;
  const n = Number(value);
  if (!Number.isFinite(n)) throw new ApiError(400, `${field}: нужно число`);
  if (n < 0) throw new ApiError(400, `${field}: значение не может быть отрицательным`);
  return n;
}

/** Проверка неотрицательности только если поле пришло в запросе */
export function assertNonNegativeFields(body: Record<string, unknown>, fields: Record<string, string>) {
  for (const [key, label] of Object.entries(fields)) {
    if (body[key] !== undefined && body[key] !== null && body[key] !== "") nonNegative(body[key], label);
  }
}
