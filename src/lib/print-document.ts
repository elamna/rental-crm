"use client";

import { buildPrintDocument } from "./document-styles";

/**
 * Печать документа без открытия новой вкладки.
 *
 * Раньше документ печатали через `window.open("", "_blank")`: браузер уводил на
 * пустую страницу, в колонтитул попадал адрес `about:blank`, а всплывающее окно
 * могло вообще не открыться из-за блокировщика. Скрытый iframe печатает из той
 * же вкладки — пользователь остаётся там, где был.
 *
 * Ширину подгоняем сами: если документ шире печатного поля A4, ужимаем его
 * ровно настолько, чтобы он влез. Иначе браузер обрезал правый край таблицы,
 * и шаблон «не умещался», сколько бы его ни правили.
 */
export function printDocument(body: string, title = "Документ") {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(frame);

  const doc = frame.contentDocument;
  if (!doc) {
    frame.remove();
    return;
  }

  doc.open();
  doc.write(buildPrintDocument(title, body));
  doc.close();

  const run = () => {
    try {
      fitToPage(doc);
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } finally {
      // Даём диалогу печати забрать содержимое, только потом убираем кадр
      setTimeout(() => frame.remove(), 60_000);
      frame.contentWindow?.addEventListener("afterprint", () => frame.remove());
    }
  };

  // Пока не отрисовались шрифты и таблицы, мерить ширину бессмысленно
  if (doc.readyState === "complete") setTimeout(run, 120);
  else frame.onload = () => setTimeout(run, 120);
}

/** Печатное поле A4 при полях 12 мм по бокам — в пикселях при 96 dpi */
const PRINTABLE_WIDTH_PX = ((210 - 24) / 25.4) * 96;

/**
 * Если документ шире печатного поля — ужимаем его. Масштаб ниже 65 % не
 * опускаем: дальше текст перестаёт читаться, и лучше честный перенос.
 */
function fitToPage(doc: Document) {
  const root = doc.querySelector<HTMLElement>(".doc-render");
  if (!root) return;

  const contentWidth = Math.max(root.scrollWidth, ...[...root.querySelectorAll("table")].map((t) => t.scrollWidth));
  if (contentWidth <= PRINTABLE_WIDTH_PX + 1) return;

  const scale = Math.max(0.65, PRINTABLE_WIDTH_PX / contentWidth);
  root.style.transform = `scale(${scale})`;
  root.style.transformOrigin = "top left";
  root.style.width = `${100 / scale}%`;
}
