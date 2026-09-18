import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/auth";
import { publicCatalog, siteGuard } from "@/lib/public-site";

/** Каталог для сайта: позиции с ценой и наличием, комплекты, магазин, услуги. Только по ключу сайта */
export async function GET(req: NextRequest) {
  const denied = siteGuard(req);
  if (denied) return denied;
  try {
    return NextResponse.json(publicCatalog());
  } catch (e) {
    return apiError(e);
  }
}
