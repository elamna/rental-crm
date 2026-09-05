import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { listLeads, createLead, leadTotals } from "@/lib/repo";
import { Lead } from "@/lib/types";

export async function GET(req: NextRequest) {
  try {
    await requireAuth("leads.view");
    const p = req.nextUrl.searchParams;
    const status = (p.get("status") ?? "open") as Lead["status"];

    const leads = listLeads({
      status,
      managerId: p.get("manager") || undefined,
      source: p.get("source") || undefined,
      from: p.get("from") || undefined,
      to: p.get("to") || undefined,
      search: p.get("q") || undefined,
    });

    return NextResponse.json({ leads, totals: leadTotals({ status }) });
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth("leads.edit");
    const body = await req.json();
    if (!body.title || !String(body.title).trim()) {
      return NextResponse.json({ error: "Укажите, что нужно клиенту" }, { status: 400 });
    }
    return NextResponse.json(createLead(body), { status: 201 });
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
