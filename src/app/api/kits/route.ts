import { NextRequest, NextResponse } from "next/server";
import { requireAuth, apiError, required, assertNonNegativeFields } from "@/lib/auth";
import { listKits, createKit } from "@/lib/repo";

export async function GET() {
  try {
    await requireAuth("catalog.view");
    return NextResponse.json(listKits());
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth("catalog.edit");
    const body = await req.json();
    body.name = required(body.name, "название комплекта");
    assertNonNegativeFields(body, { price: "Цена" });
    return NextResponse.json(createKit(body), { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
