import { NextRequest, NextResponse } from "next/server";
import { requireAuth, apiError, ApiError } from "@/lib/auth";
import { importClients } from "@/lib/repo";

export async function POST(req: NextRequest) {
  try {
    await requireAuth("clients.edit");
    const rows = await req.json();
    if (!Array.isArray(rows)) throw new ApiError(400, "Ожидается список клиентов");
    return NextResponse.json(importClients(rows));
  } catch (e) {
    return apiError(e);
  }
}
