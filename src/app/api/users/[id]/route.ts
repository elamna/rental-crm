import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getSession, apiError, ApiError } from "@/lib/auth";
import { getUser, updateUser, deleteUser, passwordChangedAt } from "@/lib/repo";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth("users.view");
    const { id } = await params;
    const user = getUser(id);
    if (!user) return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    return NextResponse.json(user);
  } catch (e) {
    return apiError(e);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireAuth("users.edit");
    const { id } = await params;
    const patch = await req.json();

    const target = getUser(id);
    if (!target) return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });

    // Заблокировать самого себя — верный способ потерять доступ
    if (me.id === id && patch.isActive === false) {
      throw new ApiError(400, "Нельзя заблокировать самого себя");
    }
    // Роль администратора выдаёт и забирает только главный администратор
    if (patch.isAdmin !== undefined && patch.isAdmin !== target.isAdmin && !me.isOwner) {
      throw new ApiError(403, "Права администратора меняет только главный администратор");
    }
    // Пароль главного администратора меняет только он сам
    if (patch.password && target.isOwner && me.id !== target.id) {
      throw new ApiError(403, "Пароль главного администратора может сменить только он сам");
    }

    const user = await updateUser(id, patch);
    if (!user) return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });

    // Сменили пароль себе же — обновляем отметку в своей сессии: сессии старше
    // смены пароля перестают действовать, и следующий запрос выкинул бы из системы
    if (patch.password && me.id === id) {
      const session = await getSession();
      if (session.user) {
        session.user = { ...session.user, pwdAt: passwordChangedAt(id) };
        await session.save();
      }
    }

    return NextResponse.json(user);
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireAuth("users.edit");
    const { id } = await params;
    if (me.id === id) throw new ApiError(400, "Нельзя удалить самого себя");
    deleteUser(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
