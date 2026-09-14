import { Client } from "./types";

/**
 * Поиск клиента в чёрном списке по его данным, а не по одной конкретной карточке.
 *
 * Пометка стоит на записи, а один и тот же человек легко заводится дважды:
 * «Еламан» из чёрного списка и «еламан», созданный на бегу при оформлении
 * аренды, — разные строки в базе с одним телефоном. Предупреждение, которое
 * смотрело только на выбранную карточку, такого клиента пропускало.
 *
 * Поэтому сверяем по трём признакам, которые человек не меняет: телефон, ИИН
 * и БИН. Телефон сравниваем только цифрами — «+7 775 520 89 10» и
 * «87755208910» набраны по-разному, а номер один.
 */

export function phoneDigits(value?: string | null): string {
  const digits = (value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  // 8 707… и 7 707… — один и тот же казахстанский номер
  if (digits.length === 11) return "7" + digits.slice(1);
  if (digits.length === 10) return "7" + digits;
  return digits;
}

export interface BlacklistCandidate {
  id?: string;
  phone?: string | null;
  iin?: string | null;
  bin?: string | null;
}

/** Чем именно совпал клиент с записью в чёрном списке */
export type BlacklistMatchField = "phone" | "iin" | "bin";

export interface BlacklistMatch {
  client: Client;
  field: BlacklistMatchField;
  /** true, если чёрная метка стоит на самой этой карточке, а не на её двойнике */
  self: boolean;
}

export function findBlacklistMatch(
  candidate: BlacklistCandidate,
  clients: Client[]
): BlacklistMatch | null {
  const phone = phoneDigits(candidate.phone);
  const iin = (candidate.iin ?? "").trim();
  const bin = (candidate.bin ?? "").trim();
  if (!phone && !iin && !bin) return null;

  for (const c of clients) {
    if (!c.blacklisted) continue;
    const self = !!candidate.id && c.id === candidate.id;

    if (phone && phoneDigits(c.phone) === phone) return { client: c, field: "phone", self };
    if (iin && (c.iin ?? "").trim() === iin) return { client: c, field: "iin", self };
    if (bin && (c.bin ?? "").trim() === bin) return { client: c, field: "bin", self };
  }
  return null;
}

export const MATCH_LABELS: Record<BlacklistMatchField, string> = {
  phone: "по номеру телефона",
  iin: "по ИИН",
  bin: "по БИН",
};

/** Готовая строка для предупреждения: чем совпал и по какой причине заблокирован */
export function blacklistWarningText(match: BlacklistMatch): string {
  const reason = match.client.blacklistReason ? `: ${match.client.blacklistReason}` : "";
  if (match.self) return `Клиент в чёрном списке${reason}`;
  return `Совпадение с чёрным списком ${MATCH_LABELS[match.field]} — «${match.client.name}»${reason}`;
}
