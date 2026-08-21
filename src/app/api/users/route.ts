import { NextRequest, NextResponse } from "next/server";
import { requireAuth, apiForbidden } from "@/lib/auth";
import { listUsers, createUser } from "@/lib/repo";

export async function GET() {
  try {
    const me = await requireAuth("users.view");
    if (!me) return apiForbidden();
    return NextResponse.json(listUsers());
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireAuth("users.edit");
    if (!me) return apiForbidden();
    const body = await req.json();
    if (!body.login || !body.password || !body.name) {
      return NextResponse.json({ error: "Укажите логин, пароль и имя" }, { status: 400 });
    }
    const user = await createUser(body);
    return NextResponse.json(user, { status: 201 });
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
