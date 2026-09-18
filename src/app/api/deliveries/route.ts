import { NextRequest, NextResponse } from "next/server";
import { requireAuth, apiError, assertNonNegativeFields } from "@/lib/auth";
import { listDeliveries, createDelivery, deliveryCounts, listDeliveriesForRental } from "@/lib/repo";
import { Delivery } from "@/lib/types";
import { parseClientTypeFilter } from "@/lib/client-type";

export async function GET(req: NextRequest) {
  try {
    await requireAuth("delivery.view");
    const p = req.nextUrl.searchParams;

    // Блок доставок в карточке аренды
    const rentalId = p.get("rentalId");
    if (rentalId) return NextResponse.json(listDeliveriesForRental(rentalId));

    const status = (p.get("status") ?? undefined) as Delivery["status"] | undefined;
    const clientType = parseClientTypeFilter(p.get("clientType"));
    return NextResponse.json({
      deliveries: listDeliveries({
        status,
        courierId: p.get("courier") || undefined,
        search: p.get("q") || undefined,
        clientType,
      }),
      counts: deliveryCounts(clientType),
    });
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth("delivery.create");
    const body = await req.json();
    assertNonNegativeFields(body, { price: "Цена" });
    return NextResponse.json(createDelivery(body), { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
