import { NextRequest, NextResponse } from "next/server";
import { createWorkshopTicket, listWorkshopTickets } from "@/lib/repo";

export async function GET() {
  return NextResponse.json(listWorkshopTickets());
}

export async function POST(req: NextRequest) {
  const input = await req.json();
  if (!input.inventoryItemId) {
    return NextResponse.json({ error: "inventoryItemId is required" }, { status: 400 });
  }
  const ticket = createWorkshopTicket(input);
  return NextResponse.json(ticket, { status: 201 });
}
