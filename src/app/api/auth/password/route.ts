import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getSession, apiError, ApiError } from "@/lib/auth";
import { changeOwnPassword } from "@/lib/repo";

/**
 * Смена собственного пароля.
 *
 * Права не проверяем: свой пароль меняет любой, кто вошёл в систему. Раньше это
 * умел только администратор через «Пользователи», из-за чего пароли передавались
 * в переписке и оставались известны посторонним.
 */
export async function POST(req: NextRequest) {
  try {
    const me = await requireAuth();
    const body = await req.json();
    const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : "";
    const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";

    if (!currentPassword || !newPassword) {
      throw new ApiError(400, "Укажите текущий и новый пароль");
    }

    const { changedAt } = await changeOwnPassword(me.id, currentPassword, newPassword);

    // Своё устройство не выкидываем: сессии старше смены пароля перестают
    // действовать, поэтому текущей проставляем свежую отметку
    const session = await getSession();
    if (session.user) {
      session.user = { ...session.user, pwdAt: changedAt };
      await session.save();
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
