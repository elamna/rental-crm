import { NextRequest, NextResponse } from "next/server";
import { requireAuth, apiError, required, assertNonNegativeFields } from "@/lib/auth";
import { listClients, createClient } from "@/lib/repo";
import { jsonCompressed } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    await requireAuth("clients.view");
    return jsonCompressed(req, listClients());
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth("clients.edit");
    const body = await req.json();
    body.name = required(body.name, "имя клиента");
    assertNonNegativeFields(body, { discount: "Скидка" });
    return NextResponse.json(createClient(body), { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
