import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "bcryptjs"],
  // Ответы API — это мегабайты JSON: без сжатия список аренд весит 3,9 МБ,
  // со сжатием — около 400 КБ. На телефоне разница между «мгновенно» и «лагает»
  compress: true,
  // UPLOADS_DIR намеренно не пробрасывается сюда через env: значение по умолчанию
  // делало переменную всегда заданной, а путь к папке с документами утекал
  // в клиентскую сборку. Роуты читают её напрямую на сервере.
  async rewrites() {
    return {
      // beforeFiles — до поиска файла на диске: иначе Next отдал бы старый файл
      // из public/uploads статикой, в обход проверки входа
      beforeFiles: [{ source: "/uploads/:name", destination: "/api/file/:name" }],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
