const fs = require("fs");
const p = "src/app/documents/page.tsx";
let s = fs.readFileSync(p, "utf8");
const L = (...a) => a.join("\n");
function rep(a, b) {
  if (!s.includes(a)) {
    console.error("НЕ НАЙДЕНО: " + a.slice(0, 80));
    process.exit(1);
  }
  s = s.replace(a, b);
}

rep(
  '  Table as TableIcon, Upload, FileText, ChevronRight,\n} from "lucide-react";',
  L(
    "  Table as TableIcon, Upload, FileText, ChevronRight, Search, Printer, LayoutTemplate,",
    '} from "lucide-react";',
    'import { printDocument } from "@/lib/print-document";'
  )
);

const blueprints = [
  "/**",
  " * Готовые каркасы документов. Составлять акт с нуля в редакторе долго, а формы",
  " * у проката одни и те же — пусть менеджер начинает с готового и правит под себя.",
  " */",
  "const BLUEPRINTS: { name: string; hint: string; body: string }[] = [",
  "  {",
  '    name: "Акт приёма-передачи",',
  '    hint: "Оборудование, сроки, подписи сторон",',
  "    body: [",
  '      `<h2 style="text-align:center">АКТ ПРИЁМА-ПЕРЕДАЧИ ОБОРУДОВАНИЯ №{{rental_number}}</h2>`,',
  '      `<p style="text-align:center">{{city}}, {{date}}</p>`,',
  '      `<p><strong>{{company_name}}</strong>, в лице {{company_director}}, именуемое «Арендодатель», с одной стороны, и <strong>{{client_name}}</strong> ({{client_phone}}), именуемый «Арендатор», с другой стороны, составили настоящий акт о нижеследующем.</p>`,',
  '      `<p>1. Арендодатель передал, а Арендатор принял во временное пользование оборудование:</p>`,',
  "      `{{items_table}}`,",
  '      `<p>2. Срок аренды: с {{rental_start}} по {{rental_end}} ({{rental_days}}).</p>`,',
  '      `<p>3. Сумма аренды: {{total}} ({{total_text}}). Оплачено: {{paid}}. К оплате: {{unpaid}}.</p>`,',
  '      `<p>4. Оборудование передано в исправном состоянии, претензий к комплектности стороны не имеют.</p>`,',
  '      `<h3>Подписи сторон</h3>`,',
  '      `<table><tbody><tr><td><p><strong>Арендодатель</strong></p><p>{{company_name}}</p><p>БИН {{company_bin}}</p><p>{{company_phone}}</p><p><br></p><p>_______________ / {{company_director}}</p></td><td><p><strong>Арендатор</strong></p><p>{{client_name}}</p><p>ИИН {{client_iin}}</p><p>{{client_phone}}</p><p><br></p><p>_______________ / {{client_name}}</p></td></tr></tbody></table>`,',
  '    ].join(""),',
  "  },",
  "  {",
  '    name: "Договор аренды",',
  '    hint: "Предмет, обязанности, ответственность",',
  "    body: [",
  '      `<h2 style="text-align:center">ДОГОВОР АРЕНДЫ ОБОРУДОВАНИЯ №{{rental_number}}</h2>`,',
  '      `<p style="text-align:center">{{city}}, {{date}}</p>`,',
  '      `<p><strong>{{company_name}}</strong>, в лице {{company_director}}, именуемое «Арендодатель», и <strong>{{client_name}}</strong>, именуемый «Арендатор», заключили настоящий договор.</p>`,',
  '      `<h3>1. Предмет договора</h3>`,',
  '      `<p>1.1. Арендодатель передаёт Арендатору во временное пользование оборудование:</p>`,',
  "      `{{items_table}}`,",
  '      `<p>1.2. Срок аренды: с {{rental_start}} по {{rental_end}} ({{rental_days}}).</p>`,',
  '      `<h3>2. Стоимость и расчёты</h3>`,',
  '      `<p>2.1. Стоимость аренды составляет {{total}} ({{total_text}}).</p>`,',
  '      `<p>2.2. Залог: {{deposit}}. Оплачено: {{paid}}. К оплате: {{unpaid}}.</p>`,',
  '      `<h3>3. Обязанности Арендатора</h3>`,',
  '      `<p>3.1. Использовать оборудование по назначению и соблюдать правила эксплуатации.</p>`,',
  '      `<p>3.2. Вернуть оборудование в срок в исправном состоянии.</p>`,',
  '      `<p>3.3. Возместить ущерб при поломке, утрате или просрочке возврата.</p>`,',
  '      `<h3>4. Реквизиты и подписи</h3>`,',
  '      `<table><tbody><tr><td><p><strong>Арендодатель</strong></p><p>{{company_name}}</p><p>БИН {{company_bin}}</p><p>{{company_address}}</p><p>{{company_bank}}, БИК {{company_bik}}</p><p>Счёт {{company_account}}</p><p><br></p><p>_______________ / {{company_director}}</p></td><td><p><strong>Арендатор</strong></p><p>{{client_name}}</p><p>ИИН {{client_iin}}</p><p>{{client_phone}}</p><p>{{client_address}}</p><p><br></p><p>_______________ / {{client_name}}</p></td></tr></tbody></table>`,',
  '    ].join(""),',
  "  },",
  "  {",
  '    name: "Расписка об оплате",',
  '    hint: "Короткая форма на один лист",',
  "    body: [",
  '      `<h2 style="text-align:center">РАСПИСКА</h2>`,',
  '      `<p style="text-align:center">{{city}}, {{date}}</p>`,',
  '      `<p>{{company_name}} получила от {{client_name}} ({{client_phone}}) сумму {{paid}} ({{total_text}}) по аренде №{{rental_number}} от {{rental_start}}.</p>`,',
  '      `<p>Остаток к оплате: {{unpaid}}.</p>`,',
  '      `<p><br></p><p>Принял: _______________ / {{manager_name}}</p>`,',
  '    ].join(""),',
  "  },",
  "];",
  "",
  "const VARIABLES = [",
].join("\n");

rep("const VARIABLES = [", blueprints);

rep(
  '  const [varQuery, setVarQuery] = useState("");',
  L(
    '  const [varQuery, setVarQuery] = useState("");',
    "  const [showBlueprints, setShowBlueprints] = useState(false);"
  )
);

rep(
  L(
    "  function toggleGroup(group: string) {",
    "    setOpenGroups((prev) => prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group]);",
    "  }"
  ),
  L(
    "  function toggleGroup(group: string) {",
    "    setOpenGroups((prev) => prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group]);",
    "  }",
    "",
    "  // Список переменных длинный — глазами его листать неудобно",
    "  const query = varQuery.trim().toLowerCase();",
    "  const groups = query",
    "    ? VARIABLES.map((g) => ({",
    "        ...g,",
    "        items: g.items.filter((v) => v.key.toLowerCase().includes(query) || v.label.toLowerCase().includes(query)),",
    "      })).filter((g) => g.items.length > 0)",
    "    : VARIABLES;",
    "",
    "  function applyBlueprint(body: string, blueprintName: string) {",
    "    if (!editor) return;",
    '    if (editor.getText().trim() && !confirm("Заготовка заменит содержимое шаблона. Продолжить?")) return;',
    "    editor.commands.setContent(body);",
    "    bodyRef.current = editor.getHTML();",
    '    if (isNew && (!name.trim() || name === "Новый шаблон")) setName(blueprintName);',
    "  }"
  )
);

rep(
  L(
    '          <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 rounded-[8px] border border-[var(--color-border)] px-3 py-1.5 text-[13.5px] font-medium hover:bg-[var(--color-bg)]">',
    '            <Upload className="h-3.5 w-3.5" /> Импорт Word',
    "          </button>"
  ),
  L(
    '          <div className="relative">',
    "            <button",
    "              onClick={() => setShowBlueprints((v) => !v)}",
    '              className="flex items-center gap-1.5 rounded-[8px] border border-[var(--color-border)] px-3 py-1.5 text-[13.5px] font-medium hover:bg-[var(--color-bg)]"',
    "            >",
    '              <LayoutTemplate className="h-3.5 w-3.5" /> Заготовки',
    "            </button>",
    "            {showBlueprints && (",
    '              <div className="absolute right-0 z-30 mt-2 w-[280px] overflow-hidden rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-xl">',
    "                {BLUEPRINTS.map((b) => (",
    "                  <button",
    "                    key={b.name}",
    "                    onClick={() => { applyBlueprint(b.body, b.name); setShowBlueprints(false); }}",
    '                    className="block w-full px-3.5 py-2.5 text-left hover:bg-[var(--color-bg)]"',
    "                  >",
    '                    <div className="text-[14px] font-semibold">{b.name}</div>',
    '                    <div className="text-[12.5px] text-[var(--color-text-muted)]">{b.hint}</div>',
    "                  </button>",
    "                ))}",
    "              </div>",
    "            )}",
    "          </div>",
    "          <button",
    "            onClick={() => printDocument(bodyRef.current, name)}",
    '            className="flex items-center gap-1.5 rounded-[8px] border border-[var(--color-border)] px-3 py-1.5 text-[13.5px] font-medium hover:bg-[var(--color-bg)]"',
    '            title="Посмотреть, как ляжет на лист"',
    "          >",
    '            <Printer className="h-3.5 w-3.5" /> Печать',
    "          </button>",
    '          <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 rounded-[8px] border border-[var(--color-border)] px-3 py-1.5 text-[13.5px] font-medium hover:bg-[var(--color-bg)]">',
    '            <Upload className="h-3.5 w-3.5" /> Импорт Word',
    "          </button>"
  )
);

rep("          {VARIABLES.map((group) => (", "          {groups.map((group) => (");
rep(
  "              {openGroups.includes(group.group) && (",
  "              {(query.length > 0 || openGroups.includes(group.group)) && ("
);

fs.writeFileSync(p, s);
console.log("редактор шаблонов обновлён");
