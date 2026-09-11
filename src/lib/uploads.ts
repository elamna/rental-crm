import path from "path";
import fs from "fs";

/**
 * Где лежат загруженные файлы.
 *
 * Это фотографии инструмента, сканы удостоверений и договоров — то, что нельзя
 * отдавать без входа в систему. Раньше при незаданном UPLOADS_DIR файлы падали
 * в `public/uploads`, а эту папку Next раздаёт как обычную статику: кто знал имя
 * файла, открывал его без пароля. Имена перебираемы — время загрузки плюс шесть
 * случайных символов.
 *
 * Теперь папка по умолчанию лежит рядом с базой, на постоянном диске: файлы не
 * раздаются напрямую и не пропадают при каждом деплое. Отдаёт их только
 * `/api/file/[name]`, где есть проверка входа.
 */
const dataDir = process.env.DATA_DIR ?? path.join(process.cwd(), "data");

export const uploadsDir = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(dataDir, "uploads");

/**
 * Старое место. Файлы, загруженные до этой правки, остались там, и ссылки на
 * них уже записаны в карточках — поэтому при отдаче мы смотрим и сюда.
 */
export const legacyUploadsDir = path.join(process.cwd(), "public", "uploads");

export function ensureUploadsDir() {
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
}

/**
 * Путь к файлу по имени. Имя приходит из запроса, поэтому от него берётся
 * только последний сегмент: иначе через `../` можно было бы попросить чужой
 * файл с диска, включая саму базу.
 */
export function resolveUploadPath(name: string): string | null {
  const safe = path.basename(name);
  if (!safe || safe.startsWith(".")) return null;
  for (const dir of [uploadsDir, legacyUploadsDir]) {
    const full = path.join(dir, safe);
    if (full.startsWith(dir) && fs.existsSync(full)) return full;
  }
  return null;
}
