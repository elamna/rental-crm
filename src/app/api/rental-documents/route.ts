import { NextRequest, NextResponse } from "next/server";
import { requireAuth, apiError, ApiError } from "@/lib/auth";
import { createRentalDocument, getRental, listDocumentTemplates, listRentalDocuments, renderTemplate } from "@/lib/repo";

export async function GET(req: NextRequest) {
  try {
    await requireAuth("rentals.view");
    const rentalId = req.nextUrl.searchParams.get("rentalId");
    if (!rentalId) throw new ApiError(400, "Не указана аренда");
    return NextResponse.json(listRentalDocuments(rentalId));
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth("documents.edit");
    const body = (await req.json()) as { rentalId: string; templateId: string };

    const rental = getRental(body.rentalId);
    if (!rental) return NextResponse.json({ error: "Аренда не найдена" }, { status: 404 });

    const tpl = listDocumentTemplates().find((t) => t.id === body.templateId);
    if (!tpl) return NextResponse.json({ error: "Шаблон не найден" }, { status: 404 });

    const rendered = renderTemplate(tpl.body, rental);
    const doc = createRentalDocument({ rentalId: body.rentalId, templateId: body.templateId, name: tpl.name, body: rendered });
    return NextResponse.json(doc, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
