import { NextResponse } from "next/server";
import { listActivity } from "@/lib/repo";

export async function GET() {
  return NextResponse.json(listActivity());
}
