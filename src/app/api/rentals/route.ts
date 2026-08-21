import { NextRequest, NextResponse } from "next/server";
import { listRentals, createRental } from "@/lib/repo";
import { Rental } from "@/lib/types";

export async function GET() {
  return NextResponse.json(listRentals());
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Rental;
  const rental = createRental(body);
  return NextResponse.json(rental, { status: 201 });
}
