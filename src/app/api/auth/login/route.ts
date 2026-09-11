import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { passwordChangedAt, verifyPassword } from "@/lib/repo";

/**
 * Защита от подбора пароля.
 *
 * Система открыта в интернет по адресу Railway, а паролей у проката несколько
 * и они короткие. Без ограничения перебор идёт со скоростью примерно полторы
 * попытки в секунду — это около ста тысяч вариантов за сутки.
 *
 * Счётчик живёт в памяти процесса: отдельного хранилища ради этого заводить
 * незачем, а перезапуск сервера случается куда реже, чем перебор.
 */
const MAX_ATTEMPTS = 5;
const BLOCK_MS = 10 * 60 * 1000;
const WINDOW_MS = 15 * 60 * 1000;

declare global {
  var __loginAttempts: Map<string, { count: number; first: number; blockedUntil: number }> | undefined;
}
const attempts = (global.__loginAttempts ??= new Map());

/** Ключ считаем по логину и адресу: один подбираемый логин не должен блокировать вход всему офису */
function attemptKey(req: NextRequest, login: string) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "неизвестно";
  return `${ip}|${String(login).toLowerCase()}`;
}

function checkBlocked(key: string): number {
  const rec = attempts.get(key);
  if (!rec) return 0;
  if (rec.blockedUntil > Date.now()) return Math.ceil((rec.blockedUntil - Date.now()) / 1000);
  // Окно прошло — начинаем счёт заново
  if (Date.now() - rec.first > WINDOW_MS) attempts.delete(key);
  return 0;
}

function registerFailure(key: string) {
  const now = Date.now();
  const rec = attempts.get(key);
  if (!rec || now - rec.first > WINDOW_MS) {
    attempts.set(key, { count: 1, first: now, blockedUntil: 0 });
    return;
  }
  rec.count++;
  if (rec.count >= MAX_ATTEMPTS) rec.blockedUntil = now + BLOCK_MS;
}

export async function POST(req: NextRequest) {
  const { login, password } = await req.json();
  if (!login || !password) return NextResponse.json({ error: "Укажите логин и пароль" }, { status: 400 });

  const key = attemptKey(req, login);
  const wait = checkBlocked(key);
  if (wait > 0) {
    const minutes = Math.ceil(wait / 60);
    return NextResponse.json(
      { error: `Слишком много попыток входа. Попробуйте через ${minutes} мин.` },
      { status: 429, headers: { "Retry-After": String(wait) } }
    );
  }

  const user = await verifyPassword(login, password);
  if (!user) {
    registerFailure(key);
    // Не уточняем, что именно неверно: иначе перебор сначала находит живые логины
    return NextResponse.json({ error: "Неверный логин или пароль" }, { status: 401 });
  }

  attempts.delete(key);

  const session = await getSession();
  session.user = {
    id: user.id,
    login: user.login,
    name: user.name,
    isAdmin: user.isAdmin,
    isOwner: user.isOwner,
    permissions: user.permissions,
    pwdAt: passwordChangedAt(user.id),
  };
  await session.save();
  return NextResponse.json({ ok: true, user: session.user });
}
