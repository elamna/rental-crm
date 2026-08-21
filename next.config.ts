import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "bcryptjs"],
  // Путь к загруженным файлам через переменную среды
  env: {
    UPLOADS_DIR: process.env.UPLOADS_DIR ?? "./public/uploads",
  },
};

export default nextConfig;
