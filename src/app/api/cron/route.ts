import { NextResponse } from "next/server";
import { applyOverdueAndPenalties } from "@/lib/repo";

// Ручной запуск проверки просрочек и начисления автоматических штрафов.
// Автоматически (раз в час) вызывается фоновым планировщиком, встроенным в
// src/lib/repo.ts. Можно дёрнуть и вручную — например через внешний cron/Task
// Scheduler на Windows, если процесс Node не работает постоянно (напр. serverless-хостинг).
export async function GET() {
  const result = applyOverdueAndPenalties();
  return NextResponse.json(result);
}
