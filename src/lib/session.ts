import { SessionOptions } from "iron-session";
import { SessionUser } from "./types";

export const sessionOptions: SessionOptions = {
  cookieName: "rental_crm_session",
  password: process.env.SESSION_SECRET ?? "rental-crm-secret-key-32-chars-min!!",
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
