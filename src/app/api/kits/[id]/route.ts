import { NextRequest, NextResponse } from "next/server";
import { getKit, updateKit, deleteKit } from "@/lib/repo";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const kit = getKit(id);
  if (!kit) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(kit);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const kit = updateKit(id, await req.json());
  if (!kit) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(kit);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  deleteKit(id);
  return NextResponse.json({ ok: true });
}
