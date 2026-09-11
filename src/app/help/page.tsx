"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Search, ChevronDown, Rocket, ClipboardList, PackageCheck, Receipt, Users, Filter,
  Boxes, FileText, BellRing, Gauge, Wrench, BarChart3, Settings, ShieldCheck, HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Помощь.
 *
 * Пишется от рабочих задач проката, а не от разделов меню: человек за стойкой
 * ищет «клиент вернул не всё», а не «раздел Аренды, пункт 3». Поэтому темы
 * названы действиями, а внизу — вопросы, которые задают чаще всего.
 */

interface Topic {
  id: string;
  icon: React.ElementType;
  title: string;
  why: string;
  steps: string[];
  note?: string;
}

const TOPICS: Topic[] = [
  {
    id: "start",
    icon: Rocket,
    title: "Первый день в системе",
    why: "Четыре действия, после которых можно работать",
    steps: [
      "Зайдите в «Настройки» и смените пароль — тот, что выдал администратор, знают и другие.",
      "Откройте «Каталог» и посмотрите, что есть на складе: названия, артикулы, цены.",
      "Откройте «Аренды» — карточки красятся по состоянию: идёт, просрочена, ждём возврата.",
      "«Темп» — ваши задачи на сегодня. Часть система ставит сама: просрочки, долги, некомплект.",
    ],
  },
  {
    id: "new-rental",
    icon: ClipboardList,
    title: "Оформить аренду",
    why: "От звонка до выдачи инструмента",
    steps: [
      "Нажмите «Новая аренда» в левом меню.",
      "Найдите клиента по имени или номеру. Нет в базе — «Новый клиент», там же можно проверить долги по ИИН.",
      "Укажите срок и пункт проката. Длительность считается сама.",
      "Добавьте позиции: продукты, комплекты, услуги. Цена подставляется из каталога.",
      "Нужен акт или договор — выберите шаблон в блоке «Документы», он соберётся после сохранения.",
      "Приняли деньги — «Принять оплату», укажите способ. Появится чек.",
      "«Забронировать аренду» — карточка уходит в общий список.",
    ],
    note: "Цену в аренде поменять нельзя: прейскурант живёт в каталоге, и меняет его только администратор. Так одинаковый инструмент не уезжает то за 3 000, то за 8 000.",
  },
  {
    id: "return",
    icon: PackageCheck,
    title: "Принять возврат",
    why: "Включая случай, когда вернули не всё",
    steps: [
      "Откройте аренду и нажмите «Принять возврат».",
      "Отметьте, что именно вернули. Если комплект полный — одна галочка.",
      "Чего-то не хватает — снимите галочку «Комплект полный» и опишите, чего нет.",
      "Принять возврат можно и с долгом: инструмент важнее, долг останется висеть на клиенте.",
    ],
    note: "Некомплект уходит на отдельную страницу со всеми данными клиента и кнопкой блокировки. Вернули пылесос без трубки — это не забудется.",
  },
  {
    id: "money",
    icon: Receipt,
    title: "Деньги и чек",
    why: "Кто заплатил, чем и сколько осталось",
    steps: [
      "Оплату принимайте кнопкой «Принять оплату» — и в новой аренде, и в уже открытой.",
      "Выберите способ: наличные, Kaspi или от компании. Система запомнит, кто принял деньги.",
      "Чек виден в аренде: сумма, способ, дата, остаток.",
      "Скидку задавайте отдельным полем, а не уменьшением цены — иначе выручка перестанет сходиться.",
      "Кто заплатил, а кто нет за сутки — в «Аналитике».",
    ],
  },
  {
    id: "clients",
    icon: Users,
    title: "Клиент: история, рейтинг, долги",
    why: "Решение о выдаче по фактам, а не по впечатлению",
    steps: [
      "Карточка клиента открывается из любой аренды и из раздела «Клиенты».",
      "Рейтинг считается сам: как часто обращается, как платит, возвращает ли в срок.",
      "Проверка по реестру должников — по ИИН или БИН, прямо в карточке.",
      "Проблемного клиента отправьте в «Чёрный список» и обязательно укажите причину.",
    ],
    note: "Проверка долгов ничего не запрещает: она показывает, что известно государству. Решение остаётся за вами.",
  },
  {
    id: "funnel",
    icon: Filter,
    title: "Воронка заявок",
    why: "Чтобы позвонивший не потерялся",
    steps: [
      "Каждый звонок — карточка в «Воронке», даже если инструмент нужен через неделю.",
      "Узнали день и час — «Поставить дату», карточка уходит в колонку «Дата».",
      "Когда время придёт, она сама вернётся в «Новый клиент» — следить не нужно.",
      "Поехали к клиенту — «В пути», выберите 30 минут или час. Опоздание горит красным.",
      "Нет инструмента — вкладка «Нет в наличии». Клиент не из города — «Другой город».",
      "Вечером «Сводка за день»: обращения, аренды, отказы, кого ждём и чего не хватило.",
    ],
    note: "Самая ценная строка сводки — чего не было на складе. Это спрос, за который уже заплатили рекламой.",
  },
  {
    id: "catalog",
    icon: Boxes,
    title: "Каталог и цены",
    why: "Что мы сдаём и почём",
    steps: [
      "«Продукты» — единицы инструмента, у каждой свой артикул и своя история.",
      "«Комплекты» — несколько позиций одной строкой. «Услуги» — доставка, обучение и прочее.",
      "Цену меняет только администратор и только здесь.",
      "«Инвентаризация» — сверка того, что на полке, с тем, что в системе.",
    ],
    note: "При импорте строка пропускается, если её артикул уже занят. Система покажет, какие именно, и предложит добавить их с новыми номерами.",
  },
  {
    id: "docs",
    icon: FileText,
    title: "Документы и печать",
    why: "Акт за один клик",
    steps: [
      "Шаблоны создаются в разделе «Документы» — формат A4, как на бумаге.",
      "В тексте ставьте переменные: клиент, инструмент, сроки, суммы подставятся сами.",
      "В аренде выберите шаблон — документ соберётся с данными этой аренды.",
      "После печати система спросит, подписал ли клиент. Ответьте сразу.",
      "Неподписанные документы видно в общем реестре.",
    ],
  },
  {
    id: "reminders",
    icon: BellRing,
    title: "Напоминания клиентам",
    why: "Написать вовремя и не по памяти",
    steps: [
      "Раздел «Напоминания» показывает, кому написать сегодня и почему.",
      "Текст уже готов — проверьте и отправьте в WhatsApp одной кнопкой.",
      "Поводы: возврат завтра, возврат через три часа, просрочка, долг, клиент звонил и пропал.",
      "Шаблоны текстов правятся там же.",
    ],
  },
  {
    id: "tasks",
    icon: Gauge,
    title: "Темп: задачи",
    why: "Что система помнит за вас",
    steps: [
      "«Моя работа» — ваши задачи. «Люди» — кто чем занят, видно руководителю.",
      "Задачу можно привязать к аренде, клиенту или инструменту.",
      "Часть задач система ставит сама: просрочена аренда, остался долг, некомплект.",
      "Такие задачи закрываются сами: вернули инструмент или оплатили долг — задача исчезла.",
    ],
  },
  {
    id: "other",
    icon: Wrench,
    title: "Мастерская, доставка, магазин",
    why: "Остальная работа проката",
    steps: [
      "«Мастерская» — инструмент в ремонте или на обслуживании, со склада он не выдаётся.",
      "«Доставка» — заказы на развоз, с адресом и статусом.",
      "«Магазин» — то, что продаётся, а не сдаётся: расходники, запчасти.",
    ],
  },
  {
    id: "reports",
    icon: BarChart3,
    title: "Аналитика и финансы",
    why: "Куда смотреть владельцу",
    steps: [
      "«Аналитика» — выручка, спрос, должники, разрез за сутки: кто заплатил и кто нет.",
      "«Финансы» — касса и расходы.",
      "Периоды переключаются вверху страницы.",
    ],
  },
  {
    id: "settings",
    icon: Settings,
    title: "Настройки и безопасность",
    why: "Пароль, тема, копии базы",
    steps: [
      "«Мой пароль» — меняет каждый сам. Старый пароль спрашивается не зря: за компьютером мог сесть посторонний.",
      "После смены пароля сессии на других устройствах перестают действовать.",
      "Тема (светлая, тёмная, как в системе) запоминается в этом браузере и другим не мешает.",
      "«Резервные копии базы» — только у главного администратора. Копия снимается раз в сутки, но раз в неделю её стоит скачать себе.",
    ],
    note: "Копии лежат на том же диске, что и база. От потери диска спасает только скачанный файл.",
  },
  {
    id: "roles",
    icon: ShieldCheck,
    title: "Кто что видит",
    why: "Если раздела нет в меню",
    steps: [
      "Разделы показываются по правам: чего нельзя — того не видно.",
      "Права выдаёт администратор в разделе «Пользователи».",
      "Роль администратора и пароль главного администратора меняет только он сам.",
      "Не хватает доступа — попросите администратора, а не заводите второй аккаунт.",
    ],
  },
];

interface Faq {
  q: string;
  a: string;
}

const FAQ: Faq[] = [
  {
    q: "Не могу изменить цену в аренде",
    a: "Так и задумано. Цена берётся из каталога, менять её может только администратор и только там. Иначе один и тот же инструмент уезжает по разной цене.",
  },
  {
    q: "Клиент вернул не весь комплект",
    a: "Принимайте возврат, сняв галочку «Комплект полный», и опишите, чего нет. Запись попадёт на страницу «Некомплект» вместе с данными клиента — там же его можно заблокировать.",
  },
  {
    q: "Импорт каталога пропустил часть строк",
    a: "Значит, их артикулы уже заняты. Система показывает, какие именно, и предлагает кнопку «Добавить всё равно» — такие позиции получат новые артикулы.",
  },
  {
    q: "Забыл пароль",
    a: "Сбросить может администратор в разделе «Пользователи». После сброса старые входы на других устройствах перестают действовать.",
  },
  {
    q: "Случайно удалил нужное",
    a: "Скажите главному администратору: в «Настройках» есть копии базы за две недели, из них можно восстановить.",
  },
  {
    q: "Клиент не берёт трубку",
    a: "Оставьте карточку в воронке — через два дня молчания система сама напомнит написать ему.",
  },
];

export default function HelpPage() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(TOPICS[0].id);

  const found = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return TOPICS;
    return TOPICS.filter((t) =>
      [t.title, t.why, t.note ?? "", ...t.steps].join(" ").toLowerCase().includes(q)
    );
  }, [query]);

  const foundFaq = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return FAQ;
    return FAQ.filter((f) => (f.q + " " + f.a).toLowerCase().includes(q));
  }, [query]);

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]/70 px-4 py-4 backdrop-blur sm:px-6">
        <h1 className="font-display text-[20px] font-bold">Помощь</h1>
        <p className="text-[14px] text-[var(--color-text-muted)]">Как делать обычную работу проката в системе</p>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Что нужно сделать? Например: возврат, чек, долг"
              className="crm-input with-icon"
            />
          </div>

          {found.length === 0 && foundFaq.length === 0 && (
            <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)] p-8 text-center">
              <HelpCircle className="mx-auto mb-2 h-6 w-6 text-[var(--color-text-muted)]" />
              <p className="text-[14px] text-[var(--color-text-muted)]">
                Ничего не нашлось. Спросите администратора — и напишите ему, что искали: этот раздел дополняется.
              </p>
            </div>
          )}

          {found.map((t) => {
            const isOpen = open === t.id || query.trim().length > 0;
            return (
              <div
                key={t.id}
                className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] card-shadow"
              >
                <button
                  onClick={() => setOpen(isOpen && open === t.id ? null : t.id)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left sm:px-5"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-[var(--color-primary-soft)] text-[var(--color-primary-ink)]">
                    <t.icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold">{t.title}</span>
                    <span className="block truncate text-[13px] text-[var(--color-text-muted)]">{t.why}</span>
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-[var(--color-text-muted)] transition-transform",
                      isOpen && "rotate-180"
                    )}
                  />
                </button>

                {isOpen && (
                  <div className="border-t border-[var(--color-border)] px-4 py-4 sm:px-5">
                    <ol className="space-y-2">
                      {t.steps.map((step, i) => (
                        <li key={i} className="flex gap-3">
                          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--color-bg)] text-[12px] font-bold text-[var(--color-text-muted)]">
                            {i + 1}
                          </span>
                          <span className="text-[14px] leading-relaxed">{step}</span>
                        </li>
                      ))}
                    </ol>
                    {t.note && (
                      <p className="mt-3 rounded-[10px] bg-[var(--color-primary-soft)] px-3 py-2 text-[13.5px] leading-relaxed text-[var(--color-text)]">
                        {t.note}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {foundFaq.length > 0 && (
            <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 card-shadow sm:p-5">
              <h2 className="mb-3 font-display text-[16px] font-bold">Частые вопросы</h2>
              <div className="space-y-3">
                {foundFaq.map((f) => (
                  <div key={f.q}>
                    <p className="text-[14px] font-semibold">{f.q}</p>
                    <p className="mt-0.5 text-[13.5px] leading-relaxed text-[var(--color-text-muted)]">{f.a}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4 sm:p-5">
            <p className="text-[14px] font-semibold">Что-то работает не так</p>
            <p className="mt-1 text-[13.5px] leading-relaxed text-[var(--color-text-muted)]">
              Опишите администратору три вещи: что вы делали, что ожидали увидеть и что увидели вместо этого.
              С этим разбираются за минуты, а с «не работает» — за часы. Номер аренды или имя клиента тоже помогают.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href="/settings"
                className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2 text-[13.5px] font-semibold transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary-ink)]"
              >
                Настройки и пароль
              </Link>
              <Link
                href="/tasks"
                className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2 text-[13.5px] font-semibold transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary-ink)]"
              >
                Мои задачи
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
