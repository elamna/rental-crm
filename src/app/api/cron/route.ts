import { NextRequest, NextResponse } from "next/server";
import { applyOverdueAndPenalties } from "@/lib/repo";
import { getCurrentUser } from "@/lib/auth";

/**
 * Ручной запуск проверки просрочек и начисления автоматических штрафов.
 * Автоматически (раз в час) вызывается фоновым планировщиком в src/lib/repo.ts.
 *
 * Доступ: авторизованный пользователь либо внешний планировщик с заголовком
 * x-cron-secret, совпадающим с переменной окружения CRON_SECRET. Если переменная
 * не задана — эндпоинт открыт, чтобы не сломать уже настроенный внешний cron.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const provided = req.headers.get("x-cron-secret");
    if (provided !== secret && !(await getCurrentUser())) {
      return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
    }
  }
  return NextResponse.json(applyOverdueAndPenalties());
}
