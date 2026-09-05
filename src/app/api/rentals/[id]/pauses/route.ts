import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { listRentalPauses, pauseRental, resumeRental } from "@/lib/repo";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireAuth("rentals.view");
    return NextResponse.json(listRentalPauses(id));
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}

/** { action: "pause" | "resume", reason? } */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const me = await requireAuth("rentals.edit");
    const { action, reason } = await req.json();

    const rental = action === "resume" ? resumeRental(id, me.name) : pauseRental(id, me.name, reason);
    if (!rental) return NextResponse.json({ error: "Аренда не найдена" }, { status: 404 });

    return NextResponse.json({ rental, pauses: listRentalPauses(id) });
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
