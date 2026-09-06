import { NextRequest, NextResponse } from "next/server";
import { requireAuth, apiError, ApiError, required } from "@/lib/auth";
import { listUsers, createUser } from "@/lib/repo";

export async function GET() {
  try {
    await requireAuth("users.view");
    return NextResponse.json(listUsers());
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireAuth("users.edit");
    const body = await req.json();
    required(body.login, "логин");
    required(body.password, "пароль");
    required(body.name, "имя");

    // Полный доступ раздаёт только главный администратор — иначе любой
    // сотрудник с правом на пользователей поднял бы себе права
    if (body.isAdmin && !me.isOwner) {
      throw new ApiError(403, "Права администратора выдаёт только главный администратор");
    }

    return NextResponse.json(await createUser(body), { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
