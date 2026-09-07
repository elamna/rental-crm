import { NextRequest, NextResponse } from "next/server";
import { requireAuth, apiError, ApiError, required } from "@/lib/auth";
import { createShortage, listShortages } from "@/lib/repo";

/** Неполные возвраты: что не хватает, по какой аренде и у кого */
export async function GET(req: NextRequest) {
  try {
    await requireAuth("rentals.view");
    const status = req.nextUrl.searchParams.get("status");
    return NextResponse.json(listShortages(status === "resolved" || status === "all" ? status : "open"));
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireAuth("rentals.edit");
    const body = await req.json();
    if (!body?.rentalId) throw new ApiError(400, "Не указана аренда");
    body.itemName = required(body.itemName, "что принято не полностью");

    return NextResponse.json(
      createShortage({
        rentalId: body.rentalId,
        inventoryItemId: body.inventoryItemId,
        itemName: body.itemName,
        note: body.note,
        actorName: me.name,
      }),
      { status: 201 }
    );
  } catch (e) {
    return apiError(e);
  }
}
