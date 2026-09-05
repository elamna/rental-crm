import { NextRequest, NextResponse } from "next/server";
import { getService, updateService, deleteService } from "@/lib/repo";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const service = getService(id);
  if (!service) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(service);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const service = updateService(id, await req.json());
  if (!service) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(service);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  deleteService(id);
  return NextResponse.json({ ok: true });
}
