import { NextRequest, NextResponse } from "next/server";
import { getRental, updateRental, deleteRental } from "@/lib/repo";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

// При открытии карточки просроченной аренды — пересчитываем total по фактическим дням
function recalcIfOverdue(id: string) {
  const row = db.prepare(`SELECT * FROM rentals WHERE id = ?`).get(id) as {
    id: string; status: string; start_at: string; end_at: string;
    total: number; items_json: string; auto_penalty_enabled: number;
    penalty_rate_per_hour: number | null;
  } | undefined;
  if (!row) return;
  if (!["overdue", "active"].includes(row.status)) return;

  const now = Date.now();
  const start = new Date(row.start_at).getTime();
  const end = new Date(row.end_at).getTime();
  if (now <= end) return;

  // Пересчёт только для посуточных аренд (не почасовой штраф)
  if (row.auto_penalty_enabled && row.penalty_rate_per_hour) return;

  try {
    const items = JSON.parse(row.items_json || "[]") as { pricePerDay: number; qty: number; category?: string }[];
    const products = items.filter((i) => i.category !== "service");
    if (products.length === 0) return;

    const actualDays = Math.max(1, Math.ceil((now - start) / 86400000));
    const bookedDays = Math.max(1, Math.ceil((end - start) / 86400000));
    if (actualDays <= bookedDays) return;

    const services = items.filter((i) => i.category === "service");
    const productTotal = products.reduce((s, i) => s + i.pricePerDay * i.qty * actualDays, 0);
    const serviceTotal = services.reduce((s, i) => s + i.pricePerDay * i.qty, 0);
    const newTotal = productTotal + serviceTotal;

    if (newTotal > row.total) {
      db.prepare(`UPDATE rentals SET total = ?, status = 'overdue', updated_at = ? WHERE id = ?`).run(
        newTotal, new Date().toISOString(), id
      );
    }
  } catch { /* ignore */ }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  recalcIfOverdue(id);
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

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireAuth("rentals.edit");
    deleteRental(id);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
