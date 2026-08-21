import { NextRequest, NextResponse } from "next/server";
import { getRental, updateRental } from "@/lib/repo";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rental = getRental(id);
  if (!rental) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(rental);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const patch = await req.json();
  const rental = updateRental(id, patch);
  if (!rental) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(rental);
}
