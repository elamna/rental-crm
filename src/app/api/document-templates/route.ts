import { NextRequest, NextResponse } from "next/server";
import { requireAuth, apiError, required } from "@/lib/auth";
import { listDocumentTemplates, createDocumentTemplate } from "@/lib/repo";

export async function GET() {
  try {
    await requireAuth("documents.view");
    return NextResponse.json(listDocumentTemplates());
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth("documents.edit");
    const body = await req.json();
    body.name = required(body.name, "название шаблона");
    return NextResponse.json(createDocumentTemplate(body), { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
