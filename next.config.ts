import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "bcryptjs"],
  // Ответы API — это мегабайты JSON: без сжатия список аренд весит 3,9 МБ,
  // со сжатием — около 400 КБ. На телефоне разница между «мгновенно» и «лагает»
  compress: true,
  // Путь к загруженным файлам через переменную среды
  env: {
    UPLOADS_DIR: process.env.UPLOADS_DIR ?? "./public/uploads",
  },
};

export default nextConfig;
