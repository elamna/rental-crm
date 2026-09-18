import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/auth";
import { createSiteLead, siteGuard } from "@/lib/public-site";

/**
 * Заявка с сайта → карточка в воронке с источником «Сайт».
 * Сюда пишет только сервер сайта (по ключу); проверки на роботов и
 * ограничение частоты — на стороне сайта, здесь — последний рубеж.
 */
export async function POST(req: NextRequest) {
  const denied = siteGuard(req);
  if (denied) return denied;
  try {
    const body = await req.json().catch(() => ({}));
    const { lead, duplicate } = createSiteLead(body);
    return NextResponse.json({ ok: true, number: lead.number, duplicate }, { status: duplicate ? 200 : 201 });
  } catch (e) {
    return apiError(e);
  }
}
