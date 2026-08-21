import { NextRequest, NextResponse } from "next/server";
import { listInventory, createInventoryItem } from "@/lib/repo";

export async function GET() {
  return NextResponse.json(listInventory());
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const item = createInventoryItem(body);
  return NextResponse.json(item, { status: 201 });
}
