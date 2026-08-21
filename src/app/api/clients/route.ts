import { NextRequest, NextResponse } from "next/server";
import { listClients, createClient } from "@/lib/repo";

export async function GET() {
  return NextResponse.json(listClients());
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const client = createClient(body);
  return NextResponse.json(client, { status: 201 });
}
