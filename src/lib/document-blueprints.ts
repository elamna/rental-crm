/**
 * Готовые каркасы документов.
 *
 * Составлять акт с нуля в редакторе долго, а формы у проката одни и те же.
 * Всё, что меняется от аренды к аренде, вписано переменными — остальное текст,
 * который правится под себя прямо в редакторе.
 */
export interface DocumentBlueprint {
  name: string;
  hint: string;
  body: string;
}

const CELL = 'style="border:1px solid #000;padding:4px 6px;vertical-align:top"';
const HEAD = 'style="border:1px solid #000;padding:4px 6px;text-align:center;font-weight:bold"';

/**
 * Акт приёма-передачи в том виде, в каком его печатает прокат: рамка с номером,
 * город и дата, преамбула сторон, таблица оборудования, восемь пунктов и подписи.
 */
const ACT = [
  '<table style="border-collapse:collapse;width:100%"><tbody><tr>',
  `<td ${CELL} style="border:1px solid #000;padding:8px;text-align:center">`,
  '<p style="text-align:center"><strong>АКТ ПРИЕМА-ПЕРЕДАЧИ №{{rental_number}} аренды</strong></p>',
  '<p style="text-align:center"><strong>ОБОРУДОВАНИЯ И МАТЕРИАЛЬНЫХ ЦЕННОСТЕЙ</strong></p>',
  "</td></tr></tbody></table>",

  '<table style="border-collapse:collapse;width:100%"><tbody><tr>',
  `<td ${CELL} style="border:1px solid #000;padding:6px;width:60%">г. {{city}}</td>`,
  `<td ${CELL} style="border:1px solid #000;padding:6px"><strong>{{datetime}}</strong></td>`,
  "</tr></tbody></table>",

  "<p><strong>{{company_name}}</strong>, в лице руководителя {{company_director}}, действующая на основании ",
  "Уведомления о регистрации в качестве Индивидуального предпринимателя, именуемое в дальнейшем ",
  "<strong>«Арендодатель»</strong>, с одной стороны, и <strong>{{client_name}}</strong> именуемое в дальнейшем ",
  "<strong>«Арендатор»</strong>, с другой стороны, именуемые совместно <strong>«Стороны»</strong>, составили настоящий ",
  "акт приема-передачи оборудования и материальных ценностей о нижеследующем.</p>",

  "<p>1. Арендодатель во исполнение пункта 3.1. настоящего Договора передал, а Арендатор принял во временное ",
  "возмездное владение и пользование Оборудование и материальные ценности с нижеследующими характеристиками:</p>",
  "<p>Идентификационные характеристики и иная информация по арендуемому Оборудованию:</p>",

  '<table style="border-collapse:collapse;width:100%"><tbody>',
  "<tr>",
  `<th ${HEAD}>Наименование инвентаря</th>`,
  `<th ${HEAD}>Серийный номер</th>`,
  `<th ${HEAD}>Категория</th>`,
  `<th ${HEAD}>Срок аренды</th>`,
  `<th ${HEAD}>Сумма аренды</th>`,
  `<th ${HEAD}>Скидка</th>`,
  "</tr>",
  "<tr>",
  `<td ${CELL}>{{product_name}}</td>`,
  `<td ${CELL}>{{product_sku}}</td>`,
  `<td ${CELL}>{{product_category}}</td>`,
  `<td ${CELL}>{{duration}}</td>`,
  `<td ${CELL}>{{inventory_total}}</td>`,
  `<td ${CELL}>{{inventory_discount}}</td>`,
  "</tr>",
  "<tr>",
  `<td ${CELL}>{{service_name}}</td>`,
  `<td ${CELL}></td>`,
  `<td ${CELL}></td>`,
  `<td ${CELL}></td>`,
  `<td ${CELL}>{{services_total}}</td>`,
  `<td ${CELL}></td>`,
  "</tr>",
  "<tr>",
  `<td ${CELL}></td>`,
  `<td ${CELL}></td>`,
  `<td ${CELL}></td>`,
  `<td ${CELL}></td>`,
  `<td ${CELL}>Стоимость доставки {{delivery_total}}</td>`,
  `<td ${CELL}></td>`,
  "</tr>",
  "<tr>",
  `<td ${CELL}></td>`,
  `<td ${CELL}></td>`,
  `<td ${CELL}></td>`,
  `<td ${CELL}><strong>ИТОГО:</strong></td>`,
  `<td ${CELL}><strong>{{total_no_discount}}</strong></td>`,
  `<td ${CELL}><strong>{{discount_total}}</strong></td>`,
  "</tr>",
  "</tbody></table>",

  "<p>2. Подписывая настоящий Акт, Стороны подтверждают, что Оборудование и материальные ценности переданы ",
  "в указанном количестве, ассортименте, комплектности.</p>",
  "<p>3. Время оформления заказа — {{start_datetime}}.</p>",
  "<p>4. Срок Аренды составляет — {{actual_start}} — {{end_datetime}}.</p>",
  "<p>5. Сумма Аренды составляет — {{total}} за Оборудования, указанные в Акте.</p>",
  "<p>6. Акт является неотъемлемой частью Договора и составлен в двух подлинных экземплярах, тексты которых ",
  "имеют одинаковую юридическую силу: один из которых находится у Арендодателя, второй — у Арендатора.</p>",
  "<p><strong>7. Просим бережно отнестись к инструменту и соблюдать чистоту инструмента, в ином случае это ",
  "повлечет за собой штраф!</strong></p>",
  "<p><strong>8. Арендатор несет ответственность за сохранность и исправное состояние полученного в аренду ",
  "оборудования на протяжении всего срока аренды.</strong></p>",

  '<p style="text-align:center"><strong>ПОДПИСИ СТОРОН</strong></p>',
  '<table style="border-collapse:collapse;width:100%"><tbody>',
  "<tr>",
  `<th ${HEAD} style="border:1px solid #000;padding:4px 6px;text-align:left;font-weight:bold">Арендодатель</th>`,
  `<th ${HEAD} style="border:1px solid #000;padding:4px 6px;text-align:left;font-weight:bold">Арендатор</th>`,
  "</tr>",
  "<tr>",
  `<td ${CELL}>`,
  "<p><strong>{{company_name}}</strong></p>",
  "<p>БИН {{company_bin}}</p>",
  "<p>Телефон {{company_phone}}</p>",
  "<p>Адрес: {{company_address}}</p>",
  "<p>ИИК {{company_account}}</p>",
  "<p>БИК {{company_bik}}</p>",
  "<p>{{company_bank}}</p>",
  "<p><br></p>",
  "<p>Руководитель ____________ / {{company_director}}</p>",
  '<p style="text-align:center">(М.П. подпись)</p>',
  "</td>",
  `<td ${CELL}>`,
  "<p><strong>{{client_name}}</strong></p>",
  "<p>ФИО: {{client_name}}</p>",
  "<p>ИИН/БИН: {{client_iin}} {{client_bin}}</p>",
  "<p>Документ №: {{client_document_number}}</p>",
  "<p>Адрес проживания: {{client_address}}</p>",
  "<p>Телефон: {{client_phone}}</p>",
  "<p><br></p>",
  "<p>Подпись ____________ / ____________</p>",
  '<p style="text-align:center">(М.П. подпись) (Ф.И.О. прописью)</p>',
  "</td>",
  "</tr>",
  "</tbody></table>",
].join("");

const CONTRACT = [
  '<h2 style="text-align:center">ДОГОВОР АРЕНДЫ ОБОРУДОВАНИЯ №{{rental_number}}</h2>',
  '<p style="text-align:center">г. {{city}}, {{date}}</p>',
  "<p><strong>{{company_name}}</strong>, в лице {{company_director}}, именуемое «Арендодатель», и ",
  "<strong>{{client_name}}</strong>, именуемый «Арендатор», заключили настоящий договор.</p>",
  "<h3>1. Предмет договора</h3>",
  "<p>1.1. Арендодатель передаёт Арендатору во временное пользование оборудование:</p>",
  "{{items_table}}",
  "<p>1.2. Срок аренды: с {{start_datetime}} по {{end_datetime}} ({{duration}}).</p>",
  "<h3>2. Стоимость и расчёты</h3>",
  "<p>2.1. Стоимость аренды составляет {{total}} ({{total_text}}).</p>",
  "<p>2.2. Залог: {{deposit}}. Оплачено: {{paid}}. К оплате: {{unpaid}}.</p>",
  "<h3>3. Обязанности Арендатора</h3>",
  "<p>3.1. Использовать оборудование по назначению и соблюдать правила эксплуатации.</p>",
  "<p>3.2. Вернуть оборудование в срок в исправном состоянии.</p>",
  "<p>3.3. Возместить ущерб при поломке, утрате или просрочке возврата.</p>",
  "<h3>4. Реквизиты и подписи</h3>",
  '<table style="border-collapse:collapse;width:100%"><tbody><tr>',
  `<td ${CELL}><p><strong>Арендодатель</strong></p><p>{{company_name}}</p><p>БИН {{company_bin}}</p>`,
  "<p>{{company_address}}</p><p>{{company_bank}}, БИК {{company_bik}}</p><p>Счёт {{company_account}}</p>",
  "<p><br></p><p>____________ / {{company_director}}</p></td>",
  `<td ${CELL}><p><strong>Арендатор</strong></p><p>{{client_name}}</p><p>ИИН {{client_iin}}</p>`,
  "<p>{{client_phone}}</p><p>{{client_address}}</p>",
  "<p><br></p><p>____________ / {{client_name}}</p></td>",
  "</tr></tbody></table>",
].join("");

const RECEIPT = [
  '<h2 style="text-align:center">РАСПИСКА</h2>',
  '<p style="text-align:center">г. {{city}}, {{date}}</p>',
  "<p>{{company_name}} получила от {{client_name}} ({{client_phone}}) сумму {{paid}} ({{paid_text}}) ",
  "по аренде №{{rental_number}} от {{start_date}}.</p>",
  "<p>Остаток к оплате: {{unpaid}}.</p>",
  "<p><br></p><p>Принял: ____________ / {{manager_name}}</p>",
].join("");

export const BLUEPRINTS: DocumentBlueprint[] = [
  { name: "Акт приёма-передачи", hint: "Полная форма: таблица оборудования, 8 пунктов, подписи", body: ACT },
  { name: "Договор аренды", hint: "Предмет, обязанности, ответственность", body: CONTRACT },
  { name: "Расписка об оплате", hint: "Короткая форма на один лист", body: RECEIPT },
];
