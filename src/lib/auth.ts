import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions } from "./session";
import { Permission, SessionUser } from "./types";

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<{ user?: SessionUser }>(cookieStore, sessionOptions);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await getSession();
  return session.user ?? null;
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
