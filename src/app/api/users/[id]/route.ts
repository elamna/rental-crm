import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getUser, updateUser, deleteUser } from "@/lib/repo";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth("users.view");
    const { id } = await params;
    const user = getUser(id);
    if (!user) return NextResponse.json({ error: "Не найден" }, { status: 404 });
    return NextResponse.json(user);
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth("users.edit");
    const { id } = await params;
    const patch = await req.json();
    const user = await updateUser(id, patch);
    if (!user) return NextResponse.json({ error: "Не найден" }, { status: 404 });
    return NextResponse.json(user);
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth("users.edit");
    const { id } = await params;
    deleteUser(id);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
