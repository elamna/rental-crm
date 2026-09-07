"use client";

import { buildPrintDocument } from "./document-styles";

/** Поля печатной страницы в миллиметрах — те же, что в `@page` и в редакторе */
export const PAGE_MARGIN_MM = 10;
/** Полезная область A4 при этих полях, в пикселях при 96 dpi */
export const PRINTABLE_WIDTH_PX = ((210 - PAGE_MARGIN_MM * 2) / 25.4) * 96;
export const PRINTABLE_HEIGHT_PX = ((297 - PAGE_MARGIN_MM * 2) / 25.4) * 96;

/**
 * Печать документа без открытия новой вкладки.
 *
 * Раньше документ печатали через `window.open("", "_blank")`: браузер уводил на
 * пустую страницу, в колонтитул попадал адрес `about:blank`, а всплывающее окно
 * могло вообще не открыться из-за блокировщика. Скрытый iframe печатает из той
 * же вкладки — пользователь остаётся там, где был.
 *
 * Перед печатью документ подгоняется под лист: и по ширине, и по высоте.
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

  // Пока не отрисовались шрифты и таблицы, мерить размеры бессмысленно
  if (doc.readyState === "complete") setTimeout(run, 120);
  else frame.onload = () => setTimeout(run, 120);
}

/**
 * Насколько документ можно ужать, чтобы он влез в одну страницу. Ниже 72 %
 * не опускаемся: дальше текст мельчает так, что подписи под ним не разобрать —
 * лучше честный перенос на второй лист.
 */
const MIN_SCALE = 0.72;

/**
 * Во сколько раз ужать документ, чтобы он лёг на лист. Вынесено отдельно от DOM,
 * чтобы расчёт можно было проверить без браузера.
 */
export function computeFitScale(contentWidth: number, contentHeight: number) {
  const widthScale = contentWidth > PRINTABLE_WIDTH_PX + 1 ? PRINTABLE_WIDTH_PX / contentWidth : 1;

  // Высоту меряем уже с учётом сжатия по ширине: оно само по себе укорачивает документ
  const heightAfterWidthFit = contentHeight * widthScale;
  const overflowPages = heightAfterWidthFit / PRINTABLE_HEIGHT_PX;

  // Ужимаем по высоте только «почти помещающийся» документ. Если он честно на две
  // страницы и больше — оставляем перенос, иначе текст станет нечитаемым
  const heightScale =
    overflowPages > 1 && overflowPages <= 1 / MIN_SCALE ? PRINTABLE_HEIGHT_PX / heightAfterWidthFit : 1;

  return Math.max(MIN_SCALE, widthScale * heightScale);
}

/**
 * Подгонка под лист: по ширине — чтобы не срезало правый край таблицы, по высоте —
 * чтобы акт, не помещающийся «на пару строк», не уезжал на вторую страницу.
 */
export function fitToPage(doc: Document) {
  const root = doc.querySelector<HTMLElement>(".doc-render");
  if (!root) return;

  const contentWidth = Math.max(root.scrollWidth, ...[...root.querySelectorAll("table")].map((t) => t.scrollWidth));
  const scale = computeFitScale(contentWidth, root.scrollHeight);
  if (scale >= 0.999) return;

  root.style.transform = `scale(${scale})`;
  root.style.transformOrigin = "top left";
  root.style.width = `${100 / scale}%`;
}

/**
 * Сколько печатных страниц займёт документ. Нужно редактору шаблона: он рисует
 * границы листов, чтобы «одна страница» на экране означала одну и на бумаге.
 */
export function measurePages(element: HTMLElement | null): number {
  if (!element) return 1;
  return Math.max(1, Math.ceil(element.scrollHeight / PRINTABLE_HEIGHT_PX));
}
