import { NextRequest, NextResponse } from "next/server";
import { requireAuth, apiError, required } from "@/lib/auth";
import { listServices, createService } from "@/lib/repo";

export async function GET() {
  try {
    await requireAuth("catalog.view");
    return NextResponse.json(listServices());
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth("catalog.edit");
    const body = await req.json();
    body.name = required(body.name, "название услуги");
    return NextResponse.json(createService(body), { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
