import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/api/auth/login"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Публичные пути — пропускаем
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return NextResponse.next();

  // Статика — пропускаем
  if (pathname.startsWith("/_next") || pathname.startsWith("/uploads") || pathname.includes(".")) {
    return NextResponse.next();
  }

  // Проверяем наличие cookie сессии (само содержимое проверяется на уровне API/страниц)
  const sessionCookie = req.cookies.get("rental_crm_session");
  if (!sessionCookie?.value) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
