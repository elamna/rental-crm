import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { verifyPassword } from "@/lib/repo";

export async function POST(req: NextRequest) {
  const { login, password } = await req.json();
  if (!login || !password) return NextResponse.json({ error: "Укажите логин и пароль" }, { status: 400 });

  const user = await verifyPassword(login, password);
  if (!user) return NextResponse.json({ error: "Неверный логин или пароль" }, { status: 401 });

  const session = await getSession();
  session.user = {
    id: user.id,
    login: user.login,
    name: user.name,
    isAdmin: user.isAdmin,
    permissions: user.isAdmin ? [] : user.permissions,
  };
  await session.save();
  return NextResponse.json({ ok: true, user: session.user });
}
