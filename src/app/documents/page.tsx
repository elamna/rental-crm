"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { DocumentTemplate } from "@/lib/types";
import {
  Plus, Pencil, Trash2, ArrowLeft, Bold, Italic, UnderlineIcon,
  AlignLeft, AlignCenter, AlignRight, AlignJustify, List, ListOrdered,
  Table as TableIcon, Upload, FileText, ChevronRight,
} from "lucide-react";

const VARIABLES = [
  { group: "Компания", items: [
    { key: "{{company_name}}", label: "Название компании" },
    { key: "{{company_bin}}", label: "БИН / ИИН" },
    { key: "{{company_director}}", label: "ФИО руководителя" },
    { key: "{{company_phone}}", label: "Телефон компании" },
    { key: "{{company_email}}", label: "Email компании" },
    { key: "{{company_address}}", label: "Адрес компании" },
    { key: "{{company_bank}}", label: "Банк" },
    { key: "{{company_bik}}", label: "БИК" },
    { key: "{{company_account}}", label: "Номер счёта" },
    { key: "{{city}}", label: "Город" },
  ]},
  { group: "Общее", items: [
    { key: "{{id}}", label: "ID" },
    { key: "{{manager_name}}", label: "Имя менеджера" },
    { key: "{{date}}", label: "Дата" },
    { key: "{{day}}", label: "День" },
    { key: "{{month}}", label: "Месяц" },
    { key: "{{year}}", label: "Год" },
    { key: "{{time}}", label: "Время" },
    { key: "{{datetime}}", label: "Дата со временем" },
  ]},
  { group: "Аренда", items: [
    { key: "{{rental_number}}", label: "№ аренды" },
    { key: "{{rental_uid}}", label: "Уникальный номер" },
    { key: "{{start_datetime}}", label: "Начало аренды" },
    { key: "{{start_date}}", label: "Дата начала аренды" },
    { key: "{{start_time}}", label: "Время начала аренды" },
    { key: "{{actual_start}}", label: "Факт. начало аренды" },
    { key: "{{end_datetime}}", label: "Конец аренды" },
    { key: "{{end_date}}", label: "Дата конца аренды" },
    { key: "{{end_time}}", label: "Время конца аренды" },
    { key: "{{actual_end}}", label: "Факт. конец аренды" },
    { key: "{{duration}}", label: "Длительность аренды" },
    { key: "{{total_no_discount}}", label: "Стоимость без скидки" },
    { key: "{{total_no_discount_text}}", label: "Стоимость без скидки (текстом)" },
    { key: "{{total}}", label: "Стоимость аренды" },
    { key: "{{total_text}}", label: "Стоимость аренды (текстом)" },
    { key: "{{inventory_total}}", label: "Стоимость инвентарей" },
    { key: "{{inventory_total_text}}", label: "Стоимость инвентарей (текстом)" },
    { key: "{{inventory_purchase_total}}", label: "Закупочная стоимость инвентарей" },
    { key: "{{inventory_purchase_total_text}}", label: "Закупочная стоимость инвентарей (текстом)" },
    { key: "{{services_total}}", label: "Стоимость услуг" },
    { key: "{{services_total_text}}", label: "Стоимость услуг (текстом)" },
    { key: "{{delivery_total}}", label: "Стоимость доставки" },
    { key: "{{delivery_total_text}}", label: "Стоимость доставки (текстом)" },
    { key: "{{daily_rate}}", label: "Стоимость аренды в день" },
    { key: "{{daily_rate_text}}", label: "Стоимость аренды в день (текстом)" },
    { key: "{{deposit}}", label: "Сумма залога" },
    { key: "{{deposit_text}}", label: "Сумма залога (текстом)" },
    { key: "{{paid}}", label: "Оплаченная сумма" },
    { key: "{{paid_text}}", label: "Оплаченная сумма (текстом)" },
    { key: "{{unpaid}}", label: "Неоплаченная сумма" },
    { key: "{{unpaid_text}}", label: "Неоплаченная сумма (текстом)" },
    { key: "{{discount_total}}", label: "Сумма скидок" },
    { key: "{{discount_total_text}}", label: "Сумма скидок (текстом)" },
    { key: "{{inventory_discount}}", label: "Сумма скидок на инвентарь" },
    { key: "{{inventory_discount_text}}", label: "Сумма скидок на инвентарь (текстом)" },
    { key: "{{services_discount}}", label: "Сумма скидок на услуги" },
    { key: "{{services_discount_text}}", label: "Сумма скидок на услуги (текстом)" },
    { key: "{{penalty_total}}", label: "Сумма штрафа" },
    { key: "{{penalty_total_text}}", label: "Сумма штрафа (текстом)" },
    { key: "{{created_by}}", label: "Создатель аренды" },
    { key: "{{created_at}}", label: "Дата создания" },
    { key: "{{booked_at}}", label: "Дата бронирования" },
    { key: "{{products_count}}", label: "Количество продуктов" },
    { key: "{{services_count}}", label: "Количество услуг" },
    { key: "{{all_inventory_total}}", label: "Стоимость всех инвентарей" },
    { key: "{{all_inventory_total_text}}", label: "Стоимость всех инвентарей (текстом)" },
    { key: "{{items_table}}", label: "Таблица товаров" },
    { key: "{{branch}}", label: "Пункт проката" },
  ]},
  { group: "Клиент", items: [
    { key: "{{client_uid}}", label: "Уникальный номер" },
    { key: "{{client_name}}", label: "ФИО / Название компании" },
    { key: "{{client_phone}}", label: "Номер телефона" },
    { key: "{{client_email}}", label: "Эл. почта" },
    { key: "{{client_discount}}", label: "Персональная скидка" },
    { key: "{{client_type}}", label: "Тип клиента" },
    { key: "{{contract_number}}", label: "Номер договора" },
    { key: "{{contract_date}}", label: "Дата подписания договора" },
    { key: "{{client_iin}}", label: "ИИН (физ. лицо)" },
    { key: "{{client_document_number}}", label: "Номер документа" },
    { key: "{{client_document_issued_at}}", label: "Дата выдачи документа" },
    { key: "{{client_document_expires_at}}", label: "Срок окончания документа" },
    { key: "{{client_birth_date}}", label: "День рождения" },
    { key: "{{client_document_issued_by}}", label: "Кем выдан" },
    { key: "{{client_bin}}", label: "БИН (юр. лицо)" },
    { key: "{{client_address}}", label: "Адрес" },
    { key: "{{client_director}}", label: "ФИО руководителя" },
    { key: "{{client_account}}", label: "Номер счёта" },
    { key: "{{client_bik}}", label: "БИК" },
    { key: "{{client_bank}}", label: "Банк" },
  ]},
  { group: "Продукты", items: [
    { key: "{{items_table}}", label: "Таблица продуктов" },
    { key: "{{product_index}}", label: "Индекс продукта" },
    { key: "{{product_uid}}", label: "Уник. номер продукта" },
    { key: "{{product_name}}", label: "Название продукта" },
    { key: "{{product_sku}}", label: "Артикул продукта" },
    { key: "{{product_category}}", label: "Категория продукта" },
    { key: "{{product_qty}}", label: "Количество продукта" },
    { key: "{{product_total}}", label: "Сумма продукта" },
    { key: "{{product_total_text}}", label: "Сумма продукта (текстом)" },
    { key: "{{product_total_discounted}}", label: "Сумма с учётом скидки" },
    { key: "{{product_total_discounted_text}}", label: "Сумма с учётом скидки (текстом)" },
    { key: "{{product_price}}", label: "Цена за единицу товара" },
    { key: "{{product_price_text}}", label: "Цена за единицу (текстом)" },
    { key: "{{product_discount}}", label: "Сумма скидки продукта" },
    { key: "{{product_discount_text}}", label: "Сумма скидки продукта (текстом)" },
    { key: "{{product_penalty}}", label: "Сумма штрафа продукта" },
    { key: "{{product_penalty_text}}", label: "Сумма штрафа продукта (текстом)" },
    { key: "{{product_purchase_price}}", label: "Закупочная стоимость" },
    { key: "{{product_purchase_price_text}}", label: "Закупочная стоимость (текстом)" },
    { key: "{{product_market_price}}", label: "Рыночная стоимость" },
    { key: "{{product_market_price_text}}", label: "Рыночная стоимость (текстом)" },
  ]},
];

const DEFAULT_BODY = `<div style="font-family:Arial,sans-serif;font-size:13px;line-height:1.6;padding:32px 40px">
<h2 style="text-align:center;font-size:14px;text-transform:uppercase;margin-bottom:4px">АКТ ПРИЕМА-ПЕРЕДАЧИ №{{rental_number}}</h2>
<h2 style="text-align:center;font-size:13px;text-transform:uppercase;margin-bottom:20px">ОБОРУДОВАНИЯ И МАТЕРИАЛЬНЫХ ЦЕННОСТЕЙ</h2>

<p style="margin-bottom:4px"><strong>г. {{city}}</strong></p>
<p>{{company_name}}, в лице руководителя {{company_director}}, именуемое далее «Арендодатель», с одной стороны, и <strong>{{client_name}}</strong>, именуемый далее «Арендатор», с другой стороны, составили настоящий акт приёма-передачи оборудования.</p>

<p><strong>Срок аренды:</strong> {{start_date}} — {{end_date}}</p>
<p><strong>Пункт проката:</strong> {{branch}}</p>

<p style="margin-top:16px"><strong>Перечень оборудования:</strong></p>
{{items_table}}

<p style="margin-top:12px"><strong>Сумма аренды:</strong> {{total}}</p>

<p style="margin-top:20px">Арендатор обязуется бережно относиться к инструменту и вернуть его в исправном состоянии.</p>

<div style="margin-top:48px;display:flex;gap:60px">
  <div style="flex:1">
    <p><strong>Арендодатель:</strong></p>
    <p>{{company_name}}</p>
    <p>БИН: {{company_bin}}</p>
    <p>Тел: {{company_phone}}</p>
    <p>Банк: {{company_bank}}</p>
    <p>БИК: {{company_bik}}</p>
    <p>ИИК: {{company_account}}</p>
    <p style="margin-top:24px">Руководитель _____________ {{company_director}}</p>
    <p style="font-size:11px;color:#999">(М.П. подпись)</p>
  </div>
  <div style="flex:1">
    <p><strong>Арендатор:</strong></p>
    <p>ФИО: {{client_name}}</p>
    <p>ИИН/БИН: {{client_iin}}</p>
    <p>Документ №: {{client_document_number}}</p>
    <p>Телефон: {{client_phone}}</p>
    <p style="margin-top:24px">Подпись _____________</p>
    <p style="font-size:11px;color:#999">(М.П. подпись) &nbsp;&nbsp;&nbsp; (Ф.И.О. прописью)</p>
  </div>
</div>
</div>`;

export default function DocumentsPage() {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<DocumentTemplate | null>(null);
  const [isNew, setIsNew] = useState(false);

  async function load() {
    const res = await fetch("/api/document-templates");
    setTemplates(await res.json());
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function deleteTemplate(id: string) {
    if (!confirm("Удалить шаблон?")) return;
    await fetch(`/api/document-templates/${id}`, { method: "DELETE" });
    load();
  }

  function openNew() {
    setEditing({ id: "", name: "Новый шаблон", body: DEFAULT_BODY, createdAt: "", updatedAt: "" });
    setIsNew(true);
  }

  async function save(name: string, body: string) {
    if (isNew) {
      await fetch("/api/document-templates", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, body }),
      });
    } else if (editing) {
      await fetch(`/api/document-templates/${editing.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, body }),
      });
    }
    setEditing(null);
    setIsNew(false);
    load();
  }

  if (editing) {
    return <TemplateEditor initial={editing} isNew={isNew} onSave={save} onBack={() => { setEditing(null); setIsNew(false); }} />;
  }

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-[var(--color-border)] bg-white/70 px-6 py-4 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-[20px] font-bold">Шаблоны документов</h1>
            <p className="text-[13px] text-[var(--color-text-muted)]">Создавайте шаблоны — переменные подставляются автоматически при генерации для аренды</p>
          </div>
          <button onClick={openNew} className="flex items-center gap-2 rounded-[10px] bg-[var(--color-primary)] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[var(--color-primary-hover)]">
            <Plus className="h-4 w-4" /> Новый шаблон
          </button>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <p className="text-[13px] text-[var(--color-text-muted)]">Загрузка…</p>
        ) : templates.length === 0 ? (
          <div className="mx-auto mt-16 max-w-md rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)] bg-white p-8 text-center card-shadow">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-[14px] bg-[var(--color-primary-soft)] text-[var(--color-primary)]"><FileText className="h-6 w-6" /></div>
            <h2 className="font-display text-[16px] font-bold">Нет шаблонов</h2>
            <p className="mt-1.5 text-[13px] text-[var(--color-text-muted)]">Создайте шаблон — он появится в каждой аренде.</p>
            <button onClick={openNew} className="mt-4 mx-auto flex items-center gap-2 rounded-[10px] bg-[var(--color-primary)] px-4 py-2 text-[13px] font-semibold text-white"><Plus className="h-4 w-4" /> Создать первый шаблон</button>
          </div>
        ) : (
          <div className="space-y-2">
            {templates.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white px-4 py-3 card-shadow">
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-[var(--color-primary-soft)] text-[var(--color-primary)]"><FileText className="h-4 w-4" /></div>
                  <div>
                    <div className="text-[14px] font-semibold">{t.name}</div>
                    <div className="text-[12px] text-[var(--color-text-muted)]">Обновлён: {new Date(t.updatedAt).toLocaleString("ru-RU")}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setEditing(t); setIsNew(false); }} className="flex items-center gap-1.5 rounded-[8px] border border-[var(--color-border)] px-3 py-1.5 text-[12.5px] hover:bg-[var(--color-bg)]"><Pencil className="h-3.5 w-3.5" /> Редактировать</button>
                  <button onClick={() => deleteTemplate(t.id)} className="grid h-8 w-8 place-items-center rounded-[8px] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[#FDECEC] hover:text-[#C0272D]"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Редактор ────────────────────────────────────────────────────────────────

function TemplateEditor({ initial, isNew, onSave, onBack }: {
  initial: DocumentTemplate; isNew: boolean;
  onSave: (name: string, body: string) => Promise<void>;
  onBack: () => void;
}) {
  const [name, setName] = useState(initial.name || "Новый шаблон");
  const [saving, setSaving] = useState(false);
  const [openGroups, setOpenGroups] = useState<string[]>([VARIABLES[0].group, VARIABLES[1].group]);
  const [editorReady, setEditorReady] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef(initial.body);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: initial.body,
    onUpdate: ({ editor }) => { bodyRef.current = editor.getHTML(); },
    onCreate: () => setEditorReady(true),
    editorProps: {
      attributes: {
        class: "outline-none min-h-[700px]",
        style: "padding: 40px; font-family: Arial, sans-serif; font-size: 13px; line-height: 1.6;",
      },
    },
  });

  function insertVariable(key: string) {
    editor?.chain().focus().insertContent(key).run();
  }

  function toggleGroup(group: string) {
    setOpenGroups((prev) => prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group]);
  }

  async function importWord(file: File) {
    const mammoth = await import("mammoth");
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.convertToHtml({ arrayBuffer });
    if (editor && result.value) {
      editor.commands.setContent(result.value);
    }
  }

  async function handleSave() {
    setSaving(true);
    await onSave(name.trim() || "Без названия", bodyRef.current);
    setSaving(false);
  }

  return (
    <div className="flex h-full flex-col">
      {/* Шапка */}
      <header className="flex items-center justify-between border-b border-[var(--color-border)] bg-white px-5 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="grid h-7 w-7 place-items-center rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Название шаблона"
            className="text-[16px] font-bold outline-none placeholder:text-[var(--color-text-muted)] border-b border-transparent focus:border-[var(--color-primary)] pb-0.5 min-w-[260px]"
          />
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept=".docx,.doc" className="hidden" onChange={(e) => e.target.files?.[0] && importWord(e.target.files[0])} />
          <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 rounded-[8px] border border-[var(--color-border)] px-3 py-1.5 text-[12.5px] font-medium hover:bg-[var(--color-bg)]">
            <Upload className="h-3.5 w-3.5" /> Импорт Word
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-[10px] bg-[var(--color-primary)] px-5 py-2 text-[13px] font-semibold text-white disabled:opacity-50 hover:bg-[var(--color-primary-hover)]"
          >
            {saving ? "Сохранение…" : "Сохранить"}
          </button>
        </div>
      </header>

      {/* Тулбар */}
      {editorReady && editor && (
        <div className="flex flex-wrap items-center gap-0.5 border-b border-[var(--color-border)] bg-[#FAFAFA] px-3 py-1.5 shrink-0">
          <ToolBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Жирный"><Bold className="h-3.5 w-3.5" /></ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Курсив"><Italic className="h-3.5 w-3.5" /></ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Подчёркнутый"><UnderlineIcon className="h-3.5 w-3.5" /></ToolBtn>
          <div className="mx-1.5 h-5 w-px bg-[var(--color-border)]" />
          <ToolBtn onClick={() => editor.chain().focus().setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })} title="По левому краю"><AlignLeft className="h-3.5 w-3.5" /></ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })} title="По центру"><AlignCenter className="h-3.5 w-3.5" /></ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().setTextAlign("right").run()} active={editor.isActive({ textAlign: "right" })} title="По правому краю"><AlignRight className="h-3.5 w-3.5" /></ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().setTextAlign("justify").run()} active={editor.isActive({ textAlign: "justify" })} title="По ширине"><AlignJustify className="h-3.5 w-3.5" /></ToolBtn>
          <div className="mx-1.5 h-5 w-px bg-[var(--color-border)]" />
          <ToolBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Список"><List className="h-3.5 w-3.5" /></ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Нумерованный список"><ListOrdered className="h-3.5 w-3.5" /></ToolBtn>
          <div className="mx-1.5 h-5 w-px bg-[var(--color-border)]" />
          <ToolBtn onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 4, withHeaderRow: true }).run()} title="Вставить таблицу"><TableIcon className="h-3.5 w-3.5" /></ToolBtn>
          <div className="mx-1.5 h-5 w-px bg-[var(--color-border)]" />
          <select className="rounded-[6px] border border-[var(--color-border)] px-2 py-1 text-[12px]" onChange={(e) => {
            const v = e.target.value;
            if (v === "p") editor.chain().focus().setParagraph().run();
            else editor.chain().focus().setHeading({ level: Number(v) as 1|2|3 }).run();
          }} defaultValue="p">
            <option value="p">Обычный</option>
            <option value="1">Заголовок 1</option>
            <option value="2">Заголовок 2</option>
            <option value="3">Заголовок 3</option>
          </select>
        </div>
      )}

      {/* Основная область */}
      <div className="flex flex-1 overflow-hidden">
        {/* Редактор */}
        <div className="flex-1 overflow-y-auto bg-[#EBEBEB]">
          <div className="mx-auto my-8 max-w-[794px] bg-white shadow-[0_2px_12px_rgba(0,0,0,0.12)] min-h-[1000px]">
            <EditorContent editor={editor} />
          </div>
        </div>

        {/* Панель переменных */}
        <div className="w-[230px] shrink-0 overflow-y-auto border-l border-[var(--color-border)] bg-white">
          <div className="sticky top-0 border-b border-[var(--color-border)] bg-white px-4 py-3 z-10">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">Переменные для шаблона</p>
            <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">Поставьте курсор → нажмите +</p>
          </div>
          {VARIABLES.map((group) => (
            <div key={group.group}>
              <button
                onClick={() => toggleGroup(group.group)}
                className="flex w-full items-center justify-between px-4 py-2.5 text-[12px] font-semibold text-[var(--color-text)] hover:bg-[var(--color-bg)] border-b border-[var(--color-border)]"
              >
                {group.group}
                <ChevronRight className={`h-3.5 w-3.5 shrink-0 transition-transform ${openGroups.includes(group.group) ? "rotate-90" : ""}`} />
              </button>
              {openGroups.includes(group.group) && (
                <div className="border-b border-[var(--color-border)]">
                  {group.items.map((v) => (
                    <div key={v.key} className="group flex items-center justify-between px-3 py-1.5 hover:bg-[var(--color-primary-soft)]">
                      <div className="min-w-0 pr-2">
                        <div className="truncate text-[10px] font-mono text-[var(--color-primary)]">{v.key}</div>
                        <div className="truncate text-[10.5px] text-[var(--color-text-muted)]">{v.label}</div>
                      </div>
                      <button
                        onClick={() => insertVariable(v.key)}
                        className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--color-primary)] text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        title={`Вставить ${v.key}`}
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ToolBtn({ onClick, active, title, children }: {
  onClick: () => void; active?: boolean; title?: string; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} title={title} className={`grid h-7 w-7 place-items-center rounded-[6px] transition ${active ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-text-muted)] hover:bg-[var(--color-border)]"}`}>
      {children}
    </button>
  );
}
