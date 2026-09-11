import { NextRequest, NextResponse } from "next/server";
import { requireAuth, apiError, required, assertNonNegativeFields, assertTextLimits, TEXT_LIMITS } from "@/lib/auth";
import { listClients, createClient } from "@/lib/repo";
import { jsonCompressed } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    await requireAuth("clients.view");
    return jsonCompressed(req, listClients());
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth("clients.edit");
    const body = await req.json();
    body.name = required(body.name, "имя клиента");
    assertNonNegativeFields(body, { discount: "Скидка" });
    assertTextLimits(body, {
      name: [TEXT_LIMITS.short, "Имя"],
      phone: [TEXT_LIMITS.short, "Телефон"],
      email: [TEXT_LIMITS.short, "Email"],
      iin: [TEXT_LIMITS.short, "ИИН"],
      bin: [TEXT_LIMITS.short, "БИН"],
      documentNumber: [TEXT_LIMITS.short, "Номер документа"],
      documentIssuedBy: [TEXT_LIMITS.medium, "Кем выдан"],
      legalAddress: [TEXT_LIMITS.medium, "Адрес"],
      companyDirector: [TEXT_LIMITS.short, "Руководитель"],
      bank: [TEXT_LIMITS.medium, "Банк"],
      bankAccount: [TEXT_LIMITS.short, "Счёт"],
      bik: [TEXT_LIMITS.short, "БИК"],
      notes: [TEXT_LIMITS.long, "Заметки"],
    });
    return NextResponse.json(createClient(body), { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
