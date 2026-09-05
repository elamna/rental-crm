import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/auth/auth-provider";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { AppShell } from "@/components/layout/app-shell";

export const metadata: Metadata = {
  title: "QURAL-SAIMAN — Аренда строительного инструмента",
  description: "CRM-система для аренды строительного инструмента и оборудования",
};

// Мобильные браузеры иначе рендерят страницу в «десктопной» ширине 980px и ужимают её
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F2F0EA" },
    { media: "(prefers-color-scheme: dark)", color: "#101012" },
  ],
};

/**
 * Выставляет тему до первой отрисовки. Без этого страница успевает мигнуть
 * светлым, пока не смонтируется ThemeProvider.
 */
const themeBootstrap = `
(function () {
  try {
    var saved = localStorage.getItem("qs-theme") || "system";
    var dark = saved === "dark" || (saved === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  } catch (e) {
    document.documentElement.setAttribute("data-theme", "light");
  }
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        <ThemeProvider>
          <AuthProvider>
            <AppShell>{children}</AppShell>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
