import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { resolveUploadPath } from "@/lib/uploads";
import { isPublicPhoto, siteGuard } from "@/lib/public-site";

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

/**
 * Фото для сайта. В папке загрузок лежат и сканы удостоверений, поэтому
 * отдаётся только картинка, которая прямо указана фото позиции, комплекта,
 * товара или логотипом, — остальное 404, даже если имя угадали.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const denied = siteGuard(req);
  if (denied) return denied;

  const { name } = await params;
  const ext = path.extname(name).toLowerCase();
  if (!MIME[ext] || !isPublicPhoto(name)) return new NextResponse("Not found", { status: 404 });
  const filePath = resolveUploadPath(name);
  if (!filePath) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(new Uint8Array(fs.readFileSync(filePath)), {
    headers: {
      "Content-Type": MIME[ext],
      "Cache-Control": "public, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
