"use client";

import { buildPrintDocument } from "./document-styles";

/** Поля печатной страницы в миллиметрах — те же, что в `@page` и в редакторе */
export const PAGE_MARGIN_MM = 10;
/** Полезная область A4 при этих полях, в пикселях при 96 dpi */
export const PRINTABLE_WIDTH_PX = ((210 - PAGE_MARGIN_MM * 2) / 25.4) * 96;
export const PRINTABLE_HEIGHT_PX = ((297 - PAGE_MARGIN_MM * 2) / 25.4) * 96;

/**
 * Насколько документ можно ужать, чтобы он влез в один лист. Ниже 70 % не
 * опускаемся: дальше подписи под текстом уже не разобрать — лучше честный
 * перенос на второй лист.
 */
const MIN_SCALE = 0.7;

/**
 * Печать документа без открытия новой вкладки.
 *
 * Раньше документ печатали через `window.open("", "_blank")`: браузер уводил на
 * пустую страницу, в колонтитул попадал адрес `about:blank`, а всплывающее окно
 * могло вообще не открыться из-за блокировщика. Скрытый iframe печатает из той
 * же вкладки — пользователь остаётся там, где был.
 *
 * Кадр создаётся размером с печатную страницу, и это не косметика: в кадре
 * нулевой ширины вёрстка схлопывается, все измерения врут — из-за этого подгонка
 * под лист не срабатывала и акт всё равно уезжал на вторую страницу.
 */
export function printDocument(body: string, title = "Документ") {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = [
    "position:fixed",
    "left:-10000px",
    "top:0",
    `width:${Math.round(PRINTABLE_WIDTH_PX)}px`,
    `height:${Math.round(PRINTABLE_HEIGHT_PX)}px`,
    "border:0",
    "opacity:0",
    "pointer-events:none",
  ].join(";");
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
  if (doc.readyState === "complete") setTimeout(run, 150);
  else frame.onload = () => setTimeout(run, 150);
}

/**
 * Сколько листов займёт документ при заданном масштабе.
 *
 * Считаем по блокам, а не по общей высоте: таблицы и заголовки не рвутся между
 * страницами, поэтому блок, не влезающий в остаток листа, уезжает на следующий
 * целиком. Из-за этого документ, который по сумме высот помещался на страницу,
 * на печати занимал две — таблица подписей уходила вниз, оставляя пол-листа
 * пустым.
 */
export function countPages(blocks: number[], scale = 1, pageHeight = PRINTABLE_HEIGHT_PX) {
  let pages = 1;
  let used = 0;

  for (const raw of blocks) {
    const height = raw * scale;

    // Блок выше страницы разорвётся сам — считаем, сколько листов он займёт
    if (height > pageHeight) {
      pages += Math.ceil((used + height) / pageHeight) - 1;
      used = (used + height) % pageHeight;
      continue;
    }
    if (used + height > pageHeight) {
      pages += 1;
      used = height;
    } else {
      used += height;
    }
  }
  return pages;
}

/**
 * Масштаб, при котором документ укладывается в один лист. Подбираем шагами:
 * формулой это не посчитать — из-за неразрывных блоков зависимость ступенчатая.
 */
export function fitScaleForOnePage(blocks: number[], contentWidth: number) {
  const widthScale = contentWidth > PRINTABLE_WIDTH_PX + 1 ? PRINTABLE_WIDTH_PX / contentWidth : 1;
  if (countPages(blocks, widthScale) <= 1) return widthScale;

  // Подбираем с запасом в пару процентов: подгонка «впритык» рассыпается от
  // любой мелочи — другого шрифта на машине, округления в драйвере принтера
  const safeHeight = PRINTABLE_HEIGHT_PX * 0.97;
  for (let scale = widthScale; scale >= MIN_SCALE; scale -= 0.02) {
    if (countPages(blocks, scale, safeHeight) <= 1) return scale;
  }
  // Не влезает даже в минимальном масштабе — печатаем как есть, с переносом
  return widthScale;
}

/**
 * Сколько листов реально выйдет из принтера — с учётом того, что печать сама
 * ужимает документ. Редактор показывает именно это число: пользователю важно,
 * что получится на бумаге, а не какой высоты вёрстка на экране.
 */
export function printedPages(blocks: number[], contentWidth = 0) {
  return countPages(blocks, fitScaleForOnePage(blocks, contentWidth));
}

/**
 * Подгонка под лист: по ширине — чтобы не срезало правый край таблицы, по
 * высоте — чтобы документу, которому не хватило пары сантиметров, не понадобился
 * второй лист.
 */
export function fitToPage(doc: Document) {
  const root = doc.querySelector<HTMLElement>(".doc-render");
  if (!root) return;

  const blocks = [...root.children].map((el) => (el as HTMLElement).getBoundingClientRect().height);
  const contentWidth = Math.max(root.scrollWidth, ...[...root.querySelectorAll("table")].map((t) => t.scrollWidth));

  const scale = fitScaleForOnePage(blocks, contentWidth);
  if (scale >= 0.999) return;

  root.style.transform = `scale(${scale})`;
  root.style.transformOrigin = "top left";
  root.style.width = `${100 / scale}%`;
}

/**
 * Сколько печатных страниц займёт содержимое редактора. Меряем так же, как при
 * печати — по блокам, а не по общей высоте.
 */
export function measurePages(element: HTMLElement | null): number {
  if (!element) return 1;
  const blocks = [...element.children].map((el) => (el as HTMLElement).getBoundingClientRect().height);
  return printedPages(blocks);
}
