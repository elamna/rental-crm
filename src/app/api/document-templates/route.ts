import { NextRequest, NextResponse } from "next/server";
import { listDocumentTemplates, createDocumentTemplate } from "@/lib/repo";

export async function GET() {
  return NextResponse.json(listDocumentTemplates());
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const tpl = createDocumentTemplate(body);
  return NextResponse.json(tpl, { status: 201 });
}
