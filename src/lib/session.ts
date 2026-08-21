import { SessionOptions } from "iron-session";
import { SessionUser } from "./types";

export const sessionOptions: SessionOptions = {
  cookieName: "rental_crm_session",
  password: process.env.SESSION_SECRET ?? "rental-crm-secret-key-32-chars-min!!",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 дней
  },
};

declare module "iron-session" {
  interface IronSessionData {
    user?: SessionUser;
  }
}
