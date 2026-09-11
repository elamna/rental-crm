import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { requireAuth, apiError } from "@/lib/auth";
import { resolveUploadPath } from "@/lib/uploads";

const MIME: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".gif": "image/gif", ".pdf": "application/pdf",
};

/**
 * Отдача загруженных файлов. Только для вошедших: здесь фотографии клиентов и
 * сканы документов. Сюда же ведёт старый адрес /uploads/... — он переписывается
 * на этот роут в next.config.ts, чтобы ранее загруженные файлы не перестали
 * открываться и при этом больше не раздавались всем подряд.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    await requireAuth();
  } catch (e) {
    return apiError(e);
  }

  const { name } = await params;
  const filePath = resolveUploadPath(name);
  if (!filePath) return new NextResponse("Not found", { status: 404 });

  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] ?? "application/octet-stream";
  const buffer = fs.readFileSync(filePath);

  // Заголовки HTTP не принимают кириллицу: имя вроде «акт_иванов.pdf» роняло
  // выдачу файла ошибкой сервера. Латиницей идёт запасное имя, настоящее —
  // отдельным полем по стандарту
  const base = path.basename(filePath);
  const asciiName = base.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "");
  const disposition =
    'inline; filename="' + asciiName + '"; filename*=UTF-8\'\'' + encodeURIComponent(base);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": mime,
      // Файл под доступом — в общих кэшах ему не место
      "Cache-Control": "private, max-age=31536000, immutable",
      // Браузер не должен угадывать тип: загруженный «рисунок» может оказаться скриптом
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": disposition,
    },
  });
}
