import { NextRequest, NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/auth";
import fs from "fs";
import path from "path";
import { uploadsDir, ensureUploadsDir } from "@/lib/uploads";

const allowedExt = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".pdf"]);

export async function POST(req: NextRequest) {
  try {
    await requireAuth();
  } catch (e) {
    return apiError(e);
  }

  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File))
    return NextResponse.json({ error: "Файл не найден в запросе" }, { status: 400 });
  if (file.size > 8 * 1024 * 1024)
    return NextResponse.json({ error: "Файл слишком большой (макс. 8МБ)" }, { status: 400 });

  const ext = path.extname(file.name).toLowerCase() || ".bin";
  if (!allowedExt.has(ext))
    return NextResponse.json({ error: "Недопустимый тип файла" }, { status: 400 });

  ensureUploadsDir();

  const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(path.join(uploadsDir, filename), buffer);

  // Всегда через роут с проверкой входа: это сканы удостоверений и договоров,
  // прямая раздача статикой открывала их любому, кто знает имя файла
  return NextResponse.json({ url: `/api/file/${filename}` }, { status: 201 });
}
