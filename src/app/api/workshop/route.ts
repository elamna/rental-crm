import { NextRequest, NextResponse } from "next/server";
import { requireAuth, apiError, required } from "@/lib/auth";
import { createWorkshopTicket, listWorkshopTickets } from "@/lib/repo";

export async function GET() {
  try {
    await requireAuth("workshop.view");
    return NextResponse.json(listWorkshopTickets());
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth("workshop.edit");
    const input = await req.json();
    required(input.inventoryItemId, "единицу инвентаря");
    required(input.title, "описание заявки");
    return NextResponse.json(createWorkshopTicket(input), { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
