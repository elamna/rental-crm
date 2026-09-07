import { gzipSync } from "zlib";

/** Ниже этого порога сжатие не окупается: время на упаковку съедает выигрыш */
const MIN_SIZE_TO_COMPRESS = 32 * 1024;

/**
 * JSON-ответ со сжатием.
 *
 * Next сжимает только страницы — ответы route handlers уходят как есть, и список
 * аренд после импорта весил 3,9 МБ на каждую загрузку. На телефоне это разница
 * между «мгновенно» и «лагает». Уровень 5 выбран сознательно: на четырёх
 * мегабайтах он тратит десятки миллисекунд процессора и даёт почти тот же
 * результат, что максимальный.
 */
export function jsonCompressed(req: Request, data: unknown) {
  const body = JSON.stringify(data);
  const acceptsGzip = (req.headers.get("accept-encoding") ?? "").includes("gzip");

  if (!acceptsGzip || body.length < MIN_SIZE_TO_COMPRESS) {
    return new Response(body, { headers: { "content-type": "application/json; charset=utf-8" } });
  }

  const packed = gzipSync(Buffer.from(body), { level: 5 });
  return new Response(new Uint8Array(packed), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-encoding": "gzip",
      "content-length": String(packed.length),
      vary: "accept-encoding",
    },
  });
}
