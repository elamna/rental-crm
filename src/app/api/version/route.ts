import { NextResponse } from "next/server";

/**
 * Какая версия сейчас развёрнута. Нужен, чтобы после пуша можно было за секунду
 * убедиться, что Railway подхватил коммит, а не смотреть на хеши бандлов —
 * они у локальной и серверной сборки не совпадают даже при одинаковом коде.
 *
 * Отдаёт только короткий SHA и время старта, поэтому не требует авторизации.
 */
const startedAt = new Date().toISOString();

export const dynamic = "force-dynamic";

export function GET() {
  const sha = process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA ?? "";
  return NextResponse.json({
    commit: sha ? sha.slice(0, 7) : "unknown",
    branch: process.env.RAILWAY_GIT_BRANCH ?? "unknown",
    startedAt,
  });
}
