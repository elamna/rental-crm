import { NextResponse } from "next/server";
import { requireAuth, apiError, ApiError } from "@/lib/auth";
import { createBackup, listBackups, lastBackupAt } from "@/lib/backup";

/**
 * Список резервных копий. Доступ только у главного администратора: копия базы —
 * это вся система целиком, включая клиентов, деньги и документы.
 */
export async function GET() {
  try {
    const me = await requireAuth("settings.view");
    if (!me.isOwner) throw new ApiError(403, "Резервные копии доступны только главному администратору");
    return NextResponse.json({ backups: listBackups(), lastBackupAt: lastBackupAt() });
  } catch (e) {
    return apiError(e);
  }
}

/** Сделать копию прямо сейчас — перед импортом или массовой правкой */
export async function POST() {
  try {
    const me = await requireAuth("settings.view");
    if (!me.isOwner) throw new ApiError(403, "Резервные копии доступны только главному администратору");
    const file = await createBackup();
    return NextResponse.json(file);
  } catch (e) {
    return apiError(e);
  }
}
