import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { listUsers } from "@/lib/repo";

/**
 * Лёгкий справочник сотрудников для выпадающих списков (исполнитель задачи,
 * менеджер заявки). Отдельно от /api/users: не требует права управлять
 * пользователями и не отдаёт в браузер права и хеши паролей.
 */
export async function GET() {
  try {
    await requireAuth();
    const staff = listUsers()
      .filter((u) => u.isActive)
      .map((u) => ({ id: u.id, name: u.name, position: u.position ?? "" }));
    return NextResponse.json(staff);
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
