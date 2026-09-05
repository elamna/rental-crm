import { NextRequest, NextResponse } from "next/server";
import { listInventoryChecks, createInventoryCheck } from "@/lib/repo";

export async function GET() {
  return NextResponse.json(listInventoryChecks());
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  return NextResponse.json(createInventoryCheck(body), { status: 201 });
}
