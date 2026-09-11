import { SessionOptions } from "iron-session";
import { SessionUser } from "./types";

/**
 * Запасной ключ — только для локальной разработки. Он лежит в открытом коде,
 * поэтому на боевом сервере с ним работать нельзя: зная ключ, можно подписать
 * себе сессию администратора и войти без пароля. Обязательно задайте
 * SESSION_SECRET в переменных окружения.
 */
const DEV_FALLBACK_SECRET = "rental-crm-secret-key-32-chars-min!!";

if (!process.env.SESSION_SECRET && process.env.NODE_ENV === "production") {
  console.error(
    "[ОПАСНО] SESSION_SECRET не задан — используется общеизвестный ключ из исходного кода. " +
      "Любой, кто видел код, может войти администратором без пароля. " +
      "Задайте SESSION_SECRET в переменных окружения и перезапустите приложение."
  );
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
