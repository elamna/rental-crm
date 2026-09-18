import crypto from "crypto";
import path from "path";
import { db, logActivity } from "./db";
import { createLead, getLead } from "./repo";
import type { InventoryLine, Lead } from "./types";

/**
 * Данные для сайта quralsaiman.com.
 *
 * Сайт — отдельный сервис. Он забирает отсюда каталог, контакты и фото и
 * присылает сюда заявки клиентов. Всё это доступно только по ключу
 * SITE_API_KEY, который знают сервер CRM и сервер сайта: браузер посетителя
 * сюда не ходит. Без ключа в окружении эти адреса выключены совсем.
 *
 * Наружу уходит только то, что и так видно на витрине: название, категория,
 * цена за сутки, сколько свободно. Серийные номера, закупочные цены, статусы
 * отдельных единиц и всё, что про клиентов, сюда не попадает.
 */

// ─── Ключ ───────────────────────────────────────────────────────────────────

/** Проверка ключа сайта; сравнение за постоянное время, чтобы ключ не подбирали по задержке */
export function checkSiteKey(provided: string | null): "ok" | "disabled" | "denied" {
  const expected = process.env.SITE_API_KEY;
  if (!expected || expected.length < 24) return "disabled";
  if (!provided) return "denied";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return "denied";
  return crypto.timingSafeEqual(a, b) ? "ok" : "denied";
}

export function siteGuard(req: Request): Response | null {
  const state = checkSiteKey(req.headers.get("x-site-key"));
  if (state === "disabled") return Response.json({ error: "Сайт не подключён" }, { status: 503 });
  if (state === "denied") return Response.json({ error: "Нет доступа" }, { status: 403 });
  return null;
}

// ─── Адреса позиций ─────────────────────────────────────────────────────────

const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m",
  н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya", ә: "a", ғ: "g", қ: "k", ң: "n", ө: "o", ұ: "u", ү: "u", һ: "h", і: "i",
};

/**
 * Адрес страницы позиции: «Перфоратор Bosch GBH 2-26» → perforator-bosch-gbh-2-26.
 * Латиницей — такие адреса не превращаются в кашу из %D0%BF при пересылке и
 * лучше читаются поисковиками. Совпадения имён разводятся коротким хвостом.
 */
export function slugify(name: string) {
  const base = name
    .toLowerCase()
    .split("")
    .map((ch) => TRANSLIT[ch] ?? ch)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
  return base || "item";
}

// ─── Фото ───────────────────────────────────────────────────────────────────

/** Имя файла из ссылки вида /uploads/xxx.jpg или /api/file/xxx.jpg */
function fileName(url: string | null | undefined) {
  if (!url) return null;
  const name = path.basename(url.split("?")[0]);
  return name && !name.startsWith(".") ? name : null;
}

/**
 * Можно ли отдать файл сайту. В папке загрузок лежат и сканы удостоверений,
 * поэтому отдаём только то, что прямо указано фотографией позиции каталога,
 * комплекта, товара магазина или логотипом компании. Всё остальное — 404,
 * даже если имя угадали.
 */
export function isPublicPhoto(name: string) {
  const safe = path.basename(name);
  const like = `%/${safe}`;
  const hit = db
    .prepare(
      `SELECT 1 FROM inventory_items WHERE photo_url LIKE @like OR photo_url = @safe
       UNION SELECT 1 FROM kits WHERE photo_url LIKE @like OR photo_url = @safe
       UNION SELECT 1 FROM shop_products WHERE photo_url LIKE @like OR photo_url = @safe
       UNION SELECT 1 FROM company_settings WHERE key = 'company_logo_url' AND (value LIKE @like OR value = @safe)
       LIMIT 1`
    )
    .get({ like, safe });
  return !!hit;
}

// ─── Каталог ────────────────────────────────────────────────────────────────

export interface PublicProduct {
  slug: string;
  name: string;
  category: string;
  /** Цена за сутки; 0 — цену не указали, на сайте будет «по запросу» */
  price: number;
  photo: string | null;
  /** Сколько единиц этого инструмента есть в прокате */
  total: number;
  /** Сколько свободно прямо сейчас: не в аренде, не в брони, не в ремонте */
  free: number;
}

export interface PublicKit {
  slug: string;
  name: string;
  category: string;
  price: number;
  photo: string | null;
  items: string[];
}

export interface PublicShopItem {
  name: string;
  category: string;
  price: number;
  photo: string | null;
  inStock: boolean;
}

export interface PublicService {
  name: string;
  category: string;
  /** Тарифы: за сутки, разово или за весь срок */
  tariffs: { type: "day" | "once" | "period"; price: number }[];
}

export function publicCatalog() {
  // Единицы, занятые будущей бронью: на складе стоят, но уже обещаны клиенту
  const booked = new Set<string>();
  for (const r of db
    .prepare(`SELECT items_json FROM rentals WHERE status IN ('booked','request')`)
    .all() as { items_json: string }[]) {
    try {
      for (const line of JSON.parse(r.items_json || "[]") as InventoryLine[]) {
        if (line.inventoryItemId) booked.add(line.inventoryItemId);
      }
    } catch {
      // битый состав не должен ронять витрину
    }
  }

  const units = db
    .prepare(`SELECT id, name, category, rental_price, photo_url, status FROM inventory_items`)
    .all() as { id: string; name: string; category: string | null; rental_price: number; photo_url: string | null; status: string }[];

  const groups = new Map<string, PublicProduct & { prices: number[] }>();
  for (const u of units) {
    // Украденное и списанное на витрине не показываем вовсе
    if (u.status === "stolen" || u.status === "written_off") continue;
    const key = u.name.trim().toLowerCase();
    let g = groups.get(key);
    if (!g) {
      g = { slug: "", name: u.name.trim(), category: u.category || "Прочее", price: 0, photo: null, total: 0, free: 0, prices: [] };
      groups.set(key, g);
    }
    g.total++;
    if (u.status === "available" && !booked.has(u.id)) g.free++;
    if (u.rental_price > 0) g.prices.push(u.rental_price);
    if (!g.photo) g.photo = fileName(u.photo_url);
  }

  const taken = new Map<string, number>();
  // Сначала порядок, потом адреса: иначе хвост «-2» у совпавших имён зависел бы
  // от порядка строк в базе и адрес страницы мог бы поменяться сам собой
  const products: PublicProduct[] = [...groups.values()]
    .sort((a, b) => a.category.localeCompare(b.category, "ru") || a.name.localeCompare(b.name, "ru"))
    .map(({ prices, ...g }) => {
      // Цена позиции — самая частая среди единиц: одна единица с опечаткой не должна её менять
      const counts = new Map<number, number>();
      for (const p of prices) counts.set(p, (counts.get(p) ?? 0) + 1);
      const price = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? 0;
      let slug = slugify(g.name);
      const n = taken.get(slug) ?? 0;
      taken.set(slug, n + 1);
      if (n > 0) slug = `${slug}-${n + 1}`;
      return { ...g, price, slug };
    });

  const kits: PublicKit[] = (
    db.prepare(`SELECT name, category, price, photo_url, lines_json FROM kits`).all() as {
      name: string;
      category: string | null;
      price: number;
      photo_url: string | null;
      lines_json: string;
    }[]
  ).map((k) => {
    let items: string[] = [];
    try {
      items = (JSON.parse(k.lines_json || "[]") as { name?: string; inventoryName?: string; qty?: number }[])
        .map((l) => `${l.inventoryName || l.name || ""}${l.qty && l.qty > 1 ? ` × ${l.qty}` : ""}`.trim())
        .filter(Boolean);
    } catch {
      items = [];
    }
    return { slug: `kit-${slugify(k.name)}`, name: k.name, category: k.category || "Комплекты", price: k.price, photo: fileName(k.photo_url), items };
  });

  const shop: PublicShopItem[] = (
    db.prepare(`SELECT name, category, price, qty, photo_url FROM shop_products ORDER BY name`).all() as {
      name: string;
      category: string | null;
      price: number;
      qty: number;
      photo_url: string | null;
    }[]
  ).map((p) => ({ name: p.name, category: p.category || "Расходники", price: p.price, photo: fileName(p.photo_url), inStock: p.qty > 0 }));

  const services: PublicService[] = (
    db.prepare(`SELECT name, category, tariffs_json FROM services ORDER BY name`).all() as {
      name: string;
      category: string | null;
      tariffs_json: string;
    }[]
  ).map((s) => {
    let tariffs: PublicService["tariffs"] = [];
    try {
      tariffs = (JSON.parse(s.tariffs_json || "[]") as { type?: string; price?: number }[])
        .filter((t) => Number(t.price) > 0 && (t.type === "day" || t.type === "once" || t.type === "period"))
        .map((t) => ({ type: t.type as "day" | "once" | "period", price: Number(t.price) }));
    } catch {
      tariffs = [];
    }
    return { name: s.name, category: s.category || "Услуги", tariffs };
  });

  return {
    products,
    kits,
    shop,
    services,
    stats: {
      products: products.length,
      units: products.reduce((s, p) => s + p.total, 0),
      freeNow: products.reduce((s, p) => s + p.free, 0),
      categories: new Set(products.map((p) => p.category)).size,
    },
    updatedAt: new Date().toISOString(),
  };
}

// ─── Компания ───────────────────────────────────────────────────────────────

/**
 * Контакты для сайта — те же, что в настройках CRM. Владелец меняет телефон
 * или часы работы в одном месте, и сайт подхватывает это сам. Реквизиты
 * (счёт, БИК) наружу не отдаются: они нужны в документах, а не на витрине.
 */
export function publicCompany() {
  const rows = db.prepare(`SELECT key, value FROM company_settings`).all() as { key: string; value: string }[];
  const s: Record<string, string> = {};
  for (const r of rows) s[r.key] = r.value;
  const clean = (v?: string) => (v ?? "").trim();
  return {
    name: clean(s.company_name),
    city: clean(s.city) || "Атырау",
    phone: clean(s.company_phone),
    whatsapp: clean(s.company_whatsapp) || clean(s.company_phone),
    email: clean(s.company_email),
    address: clean(s.company_address),
    workHours: clean(s.company_work_hours),
    instagram: clean(s.company_instagram),
    mapUrl: clean(s.company_map_url),
    bin: clean(s.company_bin),
    logo: fileName(s.company_logo_url),
  };
}

// ─── Заявки с сайта ─────────────────────────────────────────────────────────

export interface SiteLeadInput {
  name?: unknown;
  phone?: unknown;
  message?: unknown;
  items?: unknown;
  neededAt?: unknown;
  clientType?: unknown;
  locale?: unknown;
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Последние заявки с сайта в памяти процесса: сколько пришло за окно и от кого */
const recent: { at: number; phone: string }[] = [];

/**
 * Заявка с сайта → карточка в воронке, в колонке «Новый клиент», с источником
 * «Сайт». Менеджер видит её там же, где звонки и сообщения, и работает с ней
 * так же. Один и тот же номер в течение 10 минут не плодит новые карточки —
 * человек, нажавший «Отправить» трижды, остаётся одной заявкой.
 */
export function createSiteLead(input: SiteLeadInput): { lead: Lead; duplicate: boolean } {
  const name = str(input.name, 100);
  const phone = str(input.phone, 30);
  const digits = phone.replace(/\D/g, "");
  if (!name) throw Object.assign(new Error("Укажите имя"), { status: 400 });
  if (digits.length < 10 || digits.length > 12) throw Object.assign(new Error("Проверьте номер телефона"), { status: 400 });

  const now = Date.now();
  while (recent.length && now - recent[0].at > 10 * 60_000) recent.shift();
  // Предохранитель на случай утечки ключа: сотня заявок за десять минут —
  // это уже не клиенты, а робот
  if (recent.length >= 100) throw Object.assign(new Error("Слишком много заявок, попробуйте позже"), { status: 429 });

  const duplicate = recent.some((r) => r.phone === digits);
  if (duplicate) {
    const existing = db
      .prepare(`SELECT id FROM leads WHERE source = 'Сайт' AND replace(replace(replace(replace(COALESCE(phone,''),' ',''),'-',''),'(',''),')','') LIKE ? ORDER BY created_at DESC LIMIT 1`)
      .get(`%${digits.slice(-10)}`) as { id: string } | undefined;
    const lead = existing ? getLead(existing.id) : null;
    if (lead) return { lead, duplicate: true };
  }

  const items = Array.isArray(input.items)
    ? (input.items as unknown[]).map((i) => str(i, 120)).filter(Boolean).slice(0, 20)
    : [];
  const message = str(input.message, 1000);
  const neededAtRaw = str(input.neededAt, 40);
  const neededAt = neededAtRaw && !isNaN(Date.parse(neededAtRaw)) ? new Date(neededAtRaw).toISOString() : undefined;
  const clientType = input.clientType === "company" ? "company" : "individual";
  const locale = input.locale === "kk" ? "казахский" : "русский";

  const notes = [
    "Заявка с сайта quralsaiman.com",
    items.length ? `Что нужно: ${items.join(", ")}` : "",
    message ? `Комментарий: ${message}` : "",
    `Язык сайта: ${locale}`,
  ]
    .filter(Boolean)
    .join("\n");

  const lead = createLead({
    title: items.length ? items.slice(0, 3).join(", ") : "Заявка с сайта",
    clientName: name,
    phone,
    source: "Сайт",
    neededAt,
    clientType,
    notes,
  });
  recent.push({ at: now, phone: digits });
  logActivity(`Заявка с сайта: ${name}, ${phone}`);
  return { lead, duplicate: false };
}
