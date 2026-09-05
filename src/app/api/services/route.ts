import { NextRequest, NextResponse } from "next/server";
import { listServices, createService } from "@/lib/repo";

export async function GET() {
  return NextResponse.json(listServices());
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  return NextResponse.json(createService(body), { status: 201 });
}
