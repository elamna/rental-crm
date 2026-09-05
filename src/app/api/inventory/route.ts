import { NextRequest, NextResponse } from "next/server";
import { listInventory, createInventoryItem, createInventoryItems } from "@/lib/repo";

export async function GET() {
  return NextResponse.json(listInventory());
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  // quantity > 1 — создаём несколько одинаковых единиц, каждой свой артикул
  const quantity = Number(body.quantity ?? 1);
  if (quantity > 1) {
    const items = createInventoryItems(body, quantity);
    return NextResponse.json(items, { status: 201 });
  }
  const item = createInventoryItem(body);
  return NextResponse.json(item, { status: 201 });
}
