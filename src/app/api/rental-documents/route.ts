import { NextRequest, NextResponse } from "next/server";
import { createRentalDocument, getRental, listDocumentTemplates, listRentalDocuments, renderTemplate } from "@/lib/repo";

export async function GET(req: NextRequest) {
  const rentalId = req.nextUrl.searchParams.get("rentalId");
  if (!rentalId) return NextResponse.json({ error: "rentalId required" }, { status: 400 });
  return NextResponse.json(listRentalDocuments(rentalId));
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { rentalId: string; templateId: string };
  const rental = getRental(body.rentalId);
  if (!rental) return NextResponse.json({ error: "Rental not found" }, { status: 404 });

  const templates = listDocumentTemplates();
  const tpl = templates.find((t) => t.id === body.templateId);
  if (!tpl) return NextResponse.json({ error: "Template not found" }, { status: 404 });

  const rendered = renderTemplate(tpl.body, rental);
  const doc = createRentalDocument({ rentalId: body.rentalId, templateId: body.templateId, name: tpl.name, body: rendered });
  return NextResponse.json(doc, { status: 201 });
}
