import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// Локально: public/uploads (отдаётся Next.js статикой)
// На Railway/VPS: /data/uploads (постоянный диск)
const uploadsDir = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(process.cwd(), "public", "uploads");

const allowedExt = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".pdf"]);

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File))
    return NextResponse.json({ error: "Файл не найден в запросе" }, { status: 400 });
  if (file.size > 8 * 1024 * 1024)
    return NextResponse.json({ error: "Файл слишком большой (макс. 8МБ)" }, { status: 400 });

  const ext = path.extname(file.name).toLowerCase() || ".bin";
  if (!allowedExt.has(ext))
    return NextResponse.json({ error: "Недопустимый тип файла" }, { status: 400 });

  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(path.join(uploadsDir, filename), buffer);

  // Если UPLOADS_DIR задан — файлы вне public/, отдаём через /api/file/
  const url = process.env.UPLOADS_DIR ? `/api/file/${filename}` : `/uploads/${filename}`;
  return NextResponse.json({ url }, { status: 201 });
}
