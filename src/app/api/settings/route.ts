import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, requireAuth, apiError } from "@/lib/auth";
import { getCompanySettings, updateCompanySettings } from "@/lib/repo";

export async function GET() {
  try {
    await requireAuth();
  } catch (e) {
    return apiError(e);
  }
  return NextResponse.json(getCompanySettings());
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  if (!user.isAdmin) return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  const patch = await req.json();
  const settings = updateCompanySettings(patch);
  return NextResponse.json(settings);
}
