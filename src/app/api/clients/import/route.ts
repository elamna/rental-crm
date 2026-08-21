import { NextRequest, NextResponse } from "next/server";
import { importClients } from "@/lib/repo";

export async function POST(req: NextRequest) {
  const rows = await req.json();
  const result = importClients(rows);
  return NextResponse.json(result);
}
