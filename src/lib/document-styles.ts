/**
 * Стили готового документа — одни и те же для предпросмотра и для печати.
 *
 * Раньше окно печати открывалось вообще без CSS: рамки таблиц рисовало правило
 * `.ProseMirror table` из globals.css, которое там не действует. Из-за этого
 * таблицы теряли границы и заливку, а браузерный Times 16px раздувал документ
 * на вторую страницу.
 *
 * Набор повторяет правила редактора, чтобы напечатанное совпадало с шаблоном.
 */
export const DOCUMENT_CSS = `
.doc-render {
  font-family: "Segoe UI", -apple-system, Roboto, Arial, sans-serif;
  font-size: 13px;
  line-height: 1.45;
  color: #000;
}
.doc-render > *:first-child { margin-top: 0; }
.doc-render p { margin: 0.5em 0; }
.doc-render h1 { font-size: 1.4em; font-weight: bold; margin: 0.8em 0 0.4em; }
.doc-render h2 { font-size: 1.2em; font-weight: bold; margin: 0.7em 0 0.3em; }
.doc-render h3 { font-size: 1.05em; font-weight: bold; margin: 0.6em 0 0.3em; }
.doc-render ul { list-style: disc; padding-left: 1.4em; }
.doc-render ol { list-style: decimal; padding-left: 1.4em; }
.doc-render img { max-width: 100%; }

.doc-render table {
  border-collapse: collapse;
  width: 100%;
  margin: 1em 0;
  table-layout: fixed;
}
.doc-render td,
.doc-render th {
  border: 1px solid #999;
  padding: 4px 8px;
  min-width: 40px;
  vertical-align: top;
  word-wrap: break-word;
}
.doc-render th {
  background: #f0f0f0;
  font-weight: bold;
  text-align: center;
}
`;

/** Дополнительные правила, нужные только окну печати */
export const DOCUMENT_PRINT_CSS = `
@page { size: A4; margin: 14mm 12mm; }
html, body { margin: 0; padding: 0; background: #fff; }

/* Без этого браузер выбрасывает заливку ячеек и цветной текст при печати */
* { -webkit-print-color-adjust: exact; print-color-adjust: exact; }

/* Таблица может переноситься, но строка не должна разрываться пополам */
.doc-render table { page-break-inside: auto; }
.doc-render tr { page-break-inside: avoid; page-break-after: auto; }
.doc-render h1, .doc-render h2, .doc-render h3 { page-break-after: avoid; }
`;

/** Готовая страница для окна печати */
export function buildPrintDocument(title: string, body: string) {
  return `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><title>${title}</title><style>${DOCUMENT_CSS}${DOCUMENT_PRINT_CSS}</style></head><body><div class="doc-render">${body}</div></body></html>`;
}
