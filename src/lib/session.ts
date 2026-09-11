import { SessionOptions } from "iron-session";
import { SessionUser } from "./types";

/**
 * Запасной ключ — только для локальной разработки. Он лежит в открытом коде,
 * поэтому на боевом сервере с ним работать нельзя: зная ключ, любой подпишет
 * себе сессию администратора и войдёт без пароля.
 */
const DEV_FALLBACK_SECRET = "rental-crm-secret-key-32-chars-min!!";

const usingFallbackSecret = !process.env.SESSION_SECRET;

if (usingFallbackSecret && process.env.NODE_ENV === "production") {
  console.error(
    "[ОПАСНО] SESSION_SECRET не задан — используется общеизвестный ключ из исходного кода. " +
      "Система отказывается обслуживать запросы. Задайте SESSION_SECRET в переменных окружения и перезапустите приложение."
  );
}

/**
 * Проверка при каждом обращении к сессии, а не при загрузке модуля: сборка
 * Next тоже идёт с NODE_ENV=production и подтягивает этот файл — падение на
 * загрузке уронило бы сам деплой, а не защитило бы систему.
 *
 * Отказ жёсткий намеренно: тихая работа с общеизвестным ключом опаснее, чем
 * заметная ошибка. Забыть про переменную теперь невозможно.
 */
export function assertSessionSecret() {
  if (usingFallbackSecret && process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET не задан. Запасной ключ лежит в открытом исходном коде: с ним можно войти администратором без пароля. " +
        "Задайте SESSION_SECRET (случайная строка от 32 символов) в переменных окружения и перезапустите приложение."
    );
  }
}

export const sessionOptions: SessionOptions = {
  cookieName: "rental_crm_session",
  password: process.env.SESSION_SECRET ?? DEV_FALLBACK_SECRET,
  cookieOptions: {
    // secure: false — Railway/Nginx сами обеспечивают HTTPS через reverse proxy
    // Если secure: true, браузер не отправляет куки на HTTP-запросы внутри прокси
    secure: false,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 дней
  },
};

declare module "iron-session" {
  interface IronSessionData {
    user?: SessionUser;
  }
}
