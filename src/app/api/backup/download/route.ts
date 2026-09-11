import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { requireAuth, apiError, ApiError } from "@/lib/auth";
import { backupPath, snapshotToTemp } from "@/lib/backup";

/**
 * Скачивание базы.
 *
 * Без параметров снимается свежий слепок — именно он нужен владельцу, который
 * хочет унести копию с сервера. С параметром `file` отдаётся уже готовая
 * суточная копия.
 *
 * Копии на сервере лежат на том же диске, что и база: они спасают от испорченного
 * импорта и ошибочного удаления, но не от потери диска. Поэтому скачивание —
 * не украшение, а единственная защита от потери всего.
 */
export async function GET(req: NextRequest) {
  try {
    const me = await requireAuth("settings.view");
    if (!me.isOwner) throw new ApiError(403, "Резервные копии доступны только главному администратору");

    const requested = req.nextUrl.searchParams.get("file");
    let filePath: string;
    let fileName: string;
    let temporary = false;

    if (requested) {
      const found = backupPath(requested);
      if (!found) throw new ApiError(404, "Копия не найдена");
      filePath = found;
      fileName = requested;
    } else {
      const snap = await snapshotToTemp();
      filePath = snap.path;
      fileName = snap.name;
      temporary = true;
    }

    const data = fs.readFileSync(filePath);
    if (temporary) {
      // Временный слепок нужен ровно на время ответа — на диске он не остаётся
      try {
        fs.unlinkSync(filePath);
      } catch {
        // Не удалось убрать — не повод рушить скачивание, файл подчистит ротация
      }
    }

    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": "application/vnd.sqlite3",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": String(data.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
