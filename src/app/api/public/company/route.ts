import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/auth";
import { publicCompany, siteGuard } from "@/lib/public-site";

/** Контакты компании для сайта — из настроек CRM. Только по ключу сайта */
export async function GET(req: NextRequest) {
  const denied = siteGuard(req);
  if (denied) return denied;
  try {
    return NextResponse.json(publicCompany());
  } catch (e) {
    return apiError(e);
  }
}
