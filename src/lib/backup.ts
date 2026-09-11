import fs from "fs";
import path from "path";
import { db } from "./db";

/**
 * Резервные копии базы.
 *
 * Вся система живёт в одном файле SQLite, поэтому его потеря — это потеря всего:
 * аренд, клиентов, денег, документов. Копии лежат рядом с базой, на том же
 * постоянном диске, и спасают от испорченного импорта, ошибочного удаления и
 * неудачной миграции. От потери самого диска они не спасают — для этого копию
 * нужно скачать себе, поэтому в интерфейсе есть кнопка скачивания.
 *
 * Копировать файл базы обычным copy нельзя: база работает в режиме WAL, часть
 * свежих записей лежит в отдельном -wal файле, и копия получится битой или
 * отставшей. Поэтому используется штатный механизм SQLite (db.backup), который
 * снимает согласованный слепок прямо на ходу.
 */

const dataDir = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
const backupDir = path.join(dataDir, "backups");

/** Сколько копий держим на диске: суточные за две недели */
const KEEP = 14;

export interface BackupFile {
  name: string;
  size: number;
  createdAt: string;
}

function ensureDir() {
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
}

/** Имя файла: дата и время в имени, чтобы копии сортировались сами */
function backupName(now = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `app-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(
    now.getMinutes()
  )}.db`;
}

function toFile(name: string): BackupFile | null {
  const full = path.join(backupDir, name);
  if (!fs.existsSync(full)) return null;
  const st = fs.statSync(full);
  return { name, size: st.size, createdAt: st.mtime.toISOString() };
}

export function listBackups(): BackupFile[] {
  ensureDir();
  return fs
    .readdirSync(backupDir)
    .filter((f) => f.endsWith(".db"))
    .map(toFile)
    .filter((f): f is BackupFile => f !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Путь к копии по имени. Имя приходит из запроса, поэтому проверяем, что это
 * именно имя файла из папки копий, а не «../../что-нибудь-чужое».
 */
export function backupPath(name: string): string | null {
  if (path.basename(name) !== name || !name.endsWith(".db")) return null;
  const full = path.join(backupDir, name);
  if (!full.startsWith(backupDir) || !fs.existsSync(full)) return null;
  return full;
}

/** Удаляем самые старые копии, чтобы диск не заполнялся молча */
export function rotateBackups(keep = KEEP): number {
  const extra = listBackups().slice(keep);
  for (const f of extra) {
    try {
      fs.unlinkSync(path.join(backupDir, f.name));
    } catch {
      // Файл мог удалить кто-то ещё — это не повод останавливать работу
    }
  }
  return extra.length;
}

export async function createBackup(): Promise<BackupFile> {
  ensureDir();
  const name = backupName();
  await db.backup(path.join(backupDir, name));
  rotateBackups();
  return toFile(name)!;
}

/** Свежий слепок во временный файл — для скачивания, без следа на диске */
export async function snapshotToTemp(): Promise<{ path: string; name: string }> {
  ensureDir();
  const name = backupName();
  const full = path.join(backupDir, `.tmp-${name}`);
  await db.backup(full);
  return { path: full, name };
}

export function lastBackupAt(): string | null {
  return listBackups()[0]?.createdAt ?? null;
}

/**
 * Суточная копия. Вызывается из того же часового планировщика, что считает
 * просрочки: отдельный планировщик означал бы второй таймер и второй способ
 * всё сломать. Копия делается, если последней больше суток.
 */
export async function maybeDailyBackup(): Promise<BackupFile | null> {
  const last = lastBackupAt();
  if (last && Date.now() - new Date(last).getTime() < 24 * 60 * 60 * 1000) return null;
  return createBackup();
}
