"use client";

import { formatMoney, plural } from "@/lib/utils";
import type {
  DeliveryData,
  FunnelData,
  OverviewData,
  RentalsData,
  RisksData,
  ServicesData,
  ShopData,
  TeamData,
} from "@/lib/deep-report";
import { BarList, Card, Grid2, Headline, MonthlyBars, SplitBar, Table, Tile, Tiles, pct } from "./ui";

/**
 * Разделы подробного отчёта. Каждый устроен одинаково: «главное» словами,
 * четыре плитки, дальше рейтинги и не больше одного графика. Выводы в
 * «главном» считаются из тех же цифр, что показаны ниже, — их можно проверить.
 */

const n = (v: number, one: string, few: string, many: string) => `${v} ${plural(v, one, few, many)}`;

// ─── Обзор ──────────────────────────────────────────────────────────────────

export function OverviewSection({ data, periodLabel }: { data: OverviewData; periodLabel: string }) {
  const k = data.kpi;
  const biggest = [...data.income].sort((a, b) => b.value - a.value)[0];
  return (
    <div className="space-y-4">
      <Headline
        items={[
          k.income > 0 && `За ${periodLabel} прокат заработал ${formatMoney(k.income)}, мастерская обошлась в ${formatMoney(k.workshopCost)}.`,
          biggest && biggest.value > 0 && `Больше всего денег приносит ${biggest.label.toLowerCase()}.`,
          k.conversion !== null && `Из обратившихся в воронку в аренду доходит ${k.conversion}% — из тех, по кому уже есть решение.`,
          k.debtNow > 0 && `Клиенты сейчас должны ${formatMoney(k.debtNow)} — подробности во вкладке «Риски и долги».`,
        ]}
      />
      <Tiles>
        <Tile label="Поступления" value={formatMoney(k.income)} sub={`чистыми ${formatMoney(k.net)} после мастерской`} tone="primary" />
        <Tile label="Аренд" value={String(k.rentals)} sub={`средний чек ${formatMoney(k.avgCheck)}`} />
        <Tile label="Клиентов брали" value={String(k.activeClients)} sub={`+${k.newClients} новых в базе`} />
        <Tile label="Заявок в воронке" value={String(k.leads)} sub={k.conversion === null ? "решений ещё нет" : `конверсия ${k.conversion}%`} />
      </Tiles>
      <Card title="Откуда деньги" hint="Одна сумма поступлений, разложенная по источникам">
        <SplitBar parts={data.income} />
      </Card>
      <Card title="Выручка аренды по месяцам" hint="Последние двенадцать месяцев, по дате оформления аренды">
        <MonthlyBars data={data.monthly} series={[{ key: "revenue", label: "Выручка" }]} money />
      </Card>
    </div>
  );
}

// ─── Аренды ─────────────────────────────────────────────────────────────────

export function RentalsSection({ data }: { data: RentalsData }) {
  const k = data.kpi;
  const peakDay = [...data.byWeekday].sort((a, b) => b.value - a.value)[0];
  const commonLength = [...data.byLength].sort((a, b) => b.value - a.value)[0];
  return (
    <div className="space-y-4">
      <Headline
        items={[
          peakDay && peakDay.value > 0 && `Чаще всего инструмент берут ${WEEKDAY_FULL[peakDay.label] ?? peakDay.label}.`,
          commonLength && commonLength.value > 0 && `Обычная аренда — ${commonLength.label.toLowerCase()}, в среднем ${k.avgDays} дн.`,
          k.lateShare !== null && k.lateShare > 0 && `${k.lateShare}% возвратов — с опозданием больше часа.`,
          k.withDelivery > 0 && `В ${k.withDelivery}% аренд заказывают доставку.`,
        ]}
      />
      <Tiles>
        <Tile label="Аренд" value={String(k.count)} sub={`выручка ${formatMoney(k.revenue)}`} tone="primary" />
        <Tile label="Средний чек" value={formatMoney(k.avgCheck)} sub={`средняя длина ${k.avgDays} дн.`} />
        <Tile
          label="Возвращают с опозданием"
          value={pct(k.lateShare)}
          sub="от закрытых аренд"
          tone={k.lateShare && k.lateShare >= 20 ? "warning" : undefined}
        />
        <Tile label="Штрафы" value={formatMoney(k.penalties)} sub={k.penaltyCount ? n(k.penaltyCount, "начисление", "начисления", "начислений") : "не начисляли"} />
      </Tiles>
      <Grid2>
        <Card title="В какой день берут" hint="По дате начала аренды">
          <BarList rows={data.byWeekday.map((d) => ({ label: WEEKDAY_FULL_CAP[d.label] ?? d.label, value: d.value }))} />
        </Card>
        <Card title="На сколько берут">
          <BarList rows={data.byLength} />
        </Card>
      </Grid2>
      <Grid2>
        <Card title="Состояние аренд периода">
          <BarList rows={data.byStatus.sort((a, b) => b.value - a.value)} />
        </Card>
        <Card title="Тарифы и пункты проката">
          <BarList rows={data.byPeriod} />
          {data.byBranch.length > 1 && (
            <div className="mt-4 border-t border-[var(--color-border)] pt-3">
              <BarList rows={data.byBranch.map((b) => ({ label: b.label, value: b.value, display: `${b.value} · ${formatMoney(b.revenue)}` }))} />
            </div>
          )}
        </Card>
      </Grid2>
      <Grid2>
        <Card title="Залоги" hint="Чем клиенты оставляют залог">
          <BarList
            rows={data.deposits.map((d) => ({ label: d.label, value: d.value, display: d.amount ? `${d.value} · ${formatMoney(d.amount)}` : String(d.value) }))}
            empty="Залогов за период не брали"
          />
        </Card>
        <Card title="Документы" hint="Акты и договоры по арендам периода">
          <div className="grid grid-cols-3 gap-2 text-center">
            <Mini label="собрано" value={data.documents.made} />
            <Mini label="отправлено ссылкой" value={data.documents.shared} />
            <Mini label="подписано" value={data.documents.signed} />
          </div>
          {k.expenses > 0 && (
            <p className="mt-3 text-[12.5px] text-[var(--color-text-muted)]">
              Расходы, записанные в аренды (доставка, топливо и т. п.): {formatMoney(k.expenses)}
            </p>
          )}
        </Card>
      </Grid2>
      <Card title="Аренды по месяцам" hint="Сколько аренд оформляли — последние двенадцать месяцев">
        <MonthlyBars data={data.monthly} series={[{ key: "count", label: "Аренд" }]} />
      </Card>
    </div>
  );
}

// С предлогом: «во вторник», но «в среду» — склеивать «в» с днём нельзя
const WEEKDAY_FULL: Record<string, string> = {
  Пн: "в понедельник",
  Вт: "во вторник",
  Ср: "в среду",
  Чт: "в четверг",
  Пт: "в пятницу",
  Сб: "в субботу",
  Вс: "в воскресенье",
};
const WEEKDAY_FULL_CAP: Record<string, string> = {
  Пн: "Понедельник",
  Вт: "Вторник",
  Ср: "Среда",
  Чт: "Четверг",
  Пт: "Пятница",
  Сб: "Суббота",
  Вс: "Воскресенье",
};

function Mini({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-[10px] bg-[var(--color-bg)] px-2 py-2.5">
      <div className="font-display text-[19px] font-bold">{value}</div>
      <div className="text-[12px] text-[var(--color-text-muted)]">{label}</div>
    </div>
  );
}

// ─── Воронка ────────────────────────────────────────────────────────────────

export function FunnelSection({ data }: { data: FunnelData }) {
  const k = data.kpi;
  // «Не указан» — не канал, а пробел в данных: лучшим его называть нельзя
  const bestSource = data.bySource.filter((s) => s.label !== "Не указан" && s.conversion !== null && s.value >= 3).sort((a, b) => (b.conversion ?? 0) - (a.conversion ?? 0))[0];
  const topMissing = data.missing[0];
  return (
    <div className="space-y-4">
      <Headline
        items={[
          k.leads > 0 && `Обратились ${n(k.leads, "раз", "раза", "раз")}: взяли в аренду ${k.won}, отказались ${k.lost}, ещё в работе ${k.open}.`,
          bestSource && `Лучше всего доходят до аренды клиенты из «${bestSource.label}» — ${bestSource.conversion}%.`,
          topMissing && `Чаще всего просили то, чего не было: «${topMissing.label}» — ${n(topMissing.value, "раз", "раза", "раз")}.`,
          k.avgCloseDays !== null && `От обращения до аренды в среднем проходит ${k.avgCloseDays} дн.`,
        ]}
      />
      <Tiles>
        <Tile label="Обращений" value={String(k.leads)} sub={`в работе ${k.open}`} tone="primary" />
        <Tile label="Конверсия" value={pct(k.conversion)} sub="взяли из тех, кто решил" tone={k.conversion !== null && k.conversion >= 50 ? "success" : undefined} />
        <Tile label="Взяли на сумму" value={formatMoney(k.amountWon)} sub={`упустили ${formatMoney(k.amountLost)}`} />
        <Tile label="Не было в наличии" value={String(k.unavailable)} sub={k.otherCity ? `и ${k.otherCity} из другого города` : "обращений"} tone={k.unavailable ? "warning" : undefined} />
      </Tiles>
      <Card title="Путь клиента" hint="Сколько людей проходит каждый шаг">
        <BarList rows={data.stages} />
      </Card>
      <Card title="Каналы привлечения" hint="Откуда приходят и кто из них берёт">
        <Table
          head={[{ label: "Канал" }, { label: "Обращений", align: "right" }, { label: "Взяли", align: "right" }, { label: "Отказались", align: "right" }, { label: "Конверсия", align: "right" }, { label: "На сумму", align: "right" }]}
          rows={data.bySource.map((s) => ({ key: s.label, cells: [s.label, s.value, s.won, s.lost, pct(s.conversion), formatMoney(s.amountWon)] }))}
        />
      </Card>
      <Grid2>
        <Card title="Менеджеры" hint="Кто ведёт заявки и чем они заканчиваются">
          <Table
            minWidth={380}
            head={[{ label: "Менеджер" }, { label: "Заявок", align: "right" }, { label: "Взяли", align: "right" }, { label: "Конверсия", align: "right" }]}
            rows={data.byManager.map((m) => ({ key: m.label, cells: [m.label, m.value, m.won, pct(m.conversion)] }))}
          />
        </Card>
        <Card title="Что останавливает клиента" hint="Возражения, отмеченные в разговоре">
          <BarList rows={data.concerns} empty="Возражений не отмечали" />
        </Card>
      </Grid2>
      <Card title="Спрос, который не закрыли" hint="Чего не было на складе — кандидаты на закупку">
        <BarList rows={data.missing} format={(v) => n(v, "раз", "раза", "раз")} empty="Всё, что просили, было в наличии" />
      </Card>
      <Card title="Обращения по месяцам" hint="Сколько пришло и сколько из них взяли в аренду">
        <MonthlyBars
          data={data.monthly}
          series={[
            { key: "count", label: "Обращений" },
            { key: "won", label: "Взяли" },
          ]}
        />
      </Card>
    </div>
  );
}

// ─── Доставка ───────────────────────────────────────────────────────────────

export function DeliverySection({ data }: { data: DeliveryData }) {
  const k = data.kpi;
  return (
    <div className="space-y-4">
      <Headline
        items={[
          k.count > 0 && `Доставок ${k.count}: выполнено ${k.done}, отменено ${k.cancelled}.${k.income > 0 ? ` Принесли ${formatMoney(k.income)}.` : ""}`,
          k.count === 0 && "За этот период доставок не было.",
          k.onTimeShare !== null && `Вовремя приезжаем в ${k.onTimeShare}% случаев.`,
          k.avgHours !== null && `От заявки до выполненной доставки в среднем ${k.avgHours} ч.`,
        ]}
      />
      <Tiles>
        <Tile label="Доставок" value={String(k.count)} sub={`выполнено ${k.done}`} tone="primary" />
        <Tile label="Доход" value={formatMoney(k.income)} sub={`в среднем ${formatMoney(k.avgPrice)}`} />
        <Tile label="Вовремя" value={pct(k.onTimeShare)} sub="к назначенному сроку" tone={k.onTimeShare !== null && k.onTimeShare < 80 ? "warning" : undefined} />
        <Tile label="Отменено" value={String(k.cancelled)} tone={k.cancelled ? "danger" : undefined} />
      </Tiles>
      <Grid2>
        <Card title="Куда возим">
          <SplitBar parts={data.directions} format={(v) => String(v)} />
        </Card>
        <Card title="Состояние доставок">
          <BarList rows={data.byStatus} />
        </Card>
      </Grid2>
      <Card title="Курьеры">
        <Table
          head={[{ label: "Курьер" }, { label: "Доставок", align: "right" }, { label: "Выполнено", align: "right" }, { label: "Вовремя", align: "right" }, { label: "Доход", align: "right" }]}
          rows={data.byCourier.map((c) => ({ key: c.label, cells: [c.label, c.value, c.done, pct(c.onTimeShare), formatMoney(c.income)] }))}
          empty="Доставок за период не было"
        />
      </Card>
    </div>
  );
}

// ─── Магазин ────────────────────────────────────────────────────────────────

export function ShopSection({ data }: { data: ShopData }) {
  const k = data.kpi;
  return (
    <div className="space-y-4">
      <Headline
        items={[
          `На складе магазина ${n(k.stockUnits, "единица", "единицы", "единиц")} товара на ${formatMoney(k.stockValue)} по цене продажи.`,
          k.salesRevenue > 0 && `Продано ${n(k.salesUnits, "единица", "единицы", "единиц")} на ${formatMoney(k.salesRevenue)}.`,
          k.outOfStock > 0 && `${n(k.outOfStock, "товар закончился", "товара закончились", "товаров закончились")} — пора дозаказать.`,
          data.neverSold > 0 && `${n(data.neverSold, "товар", "товара", "товаров")} лежат и не продаются за этот период.`,
        ]}
      />
      <Tiles>
        <Tile label="Продано" value={formatMoney(k.salesRevenue)} sub={`${k.salesUnits} шт.`} tone="primary" />
        <Tile label="Склад по цене продажи" value={formatMoney(k.stockValue)} sub={`${k.products} позиций`} />
        <Tile label="Вложено в склад" value={formatMoney(k.stockCost)} sub="по закупочной цене" />
        <Tile label="Средняя наценка" value={k.avgMarkup === null ? "—" : `${k.avgMarkup}%`} sub="где указана закупка" />
      </Tiles>
      <Grid2>
        <Card title="Что продаётся">
          <BarList rows={data.topSold.map((s) => ({ label: s.label, value: s.value, display: `${s.value} шт. · ${formatMoney(s.revenue)}` }))} empty="Продаж за период не было" />
        </Card>
        <Card title="Заканчивается" hint="Осталось две штуки и меньше">
          <BarList rows={data.lowStock} format={(v) => `${v} шт.`} empty="Всего хватает" />
        </Card>
      </Grid2>
      <Card title="Во что вложен склад" hint="Остатки по категориям, по цене продажи">
        <BarList rows={data.stockByCategory} format={formatMoney} empty="Склад пуст" />
      </Card>
    </div>
  );
}

// ─── Услуги и комплекты ─────────────────────────────────────────────────────

export function ServicesSection({ data }: { data: ServicesData }) {
  const k = data.kpi;
  return (
    <div className="space-y-4">
      <Headline
        items={[
          k.services + k.kits === 0
            ? "Услуг и комплектов в каталоге пока нет — этот раздел заполнится, когда они появятся."
            : `Услуги есть в ${k.serviceShare}% аренд, комплекты — в ${k.kitShare}%.`,
          data.unusedServices.length > 0 && `${n(data.unusedServices.length, "услугу", "услуги", "услуг")} за период ни разу не брали.`,
          data.unusedKits.length > 0 && `${n(data.unusedKits.length, "комплект", "комплекта", "комплектов")} стоят без дела.`,
        ]}
      />
      <Tiles>
        <Tile label="Услуги принесли" value={formatMoney(k.serviceRevenue)} sub={`в ${k.serviceShare}% аренд`} tone="primary" />
        <Tile label="Комплекты принесли" value={formatMoney(k.kitRevenue)} sub={`в ${k.kitShare}% аренд`} />
        <Tile label="Услуг в каталоге" value={String(k.services)} />
        <Tile label="Комплектов в каталоге" value={String(k.kits)} />
      </Tiles>
      <Grid2>
        <Card title="Какие услуги берут">
          <BarList rows={data.topServices.map((s) => ({ label: s.label, value: s.value, display: `${s.value} · ${formatMoney(s.revenue)}` }))} empty="Услуг за период не брали" />
        </Card>
        <Card title="Какие комплекты берут">
          <BarList rows={data.topKits.map((s) => ({ label: s.label, value: s.value, display: `${s.value} · ${formatMoney(s.revenue)}` }))} empty="Комплектов за период не брали" />
        </Card>
      </Grid2>
      {(data.unusedServices.length > 0 || data.unusedKits.length > 0) && (
        <Card title="Не брали ни разу за период" hint="Кандидаты пересмотреть цену или убрать из каталога">
          <div className="flex flex-wrap gap-1.5">
            {[...data.unusedServices, ...data.unusedKits].map((name) => (
              <span key={name} className="rounded-full bg-[var(--color-bg)] px-2.5 py-1 text-[12.5px] text-[var(--color-text-muted)]">
                {name}
              </span>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Команда ────────────────────────────────────────────────────────────────

export function TeamSection({ data }: { data: TeamData }) {
  const top = data.rows[0];
  const bestCloser = data.rows.filter((r) => r.conversion !== null && r.leads >= 3).sort((a, b) => (b.conversion ?? 0) - (a.conversion ?? 0))[0];
  return (
    <div className="space-y-4">
      <Headline
        items={[
          top && `Больше всех работы за период у ${top.name}.`,
          bestCloser && `Лучше всех доводит заявки до аренды ${bestCloser.name} — ${bestCloser.conversion}%.`,
        ]}
      />
      <Card title="Кто что сделал" hint="Оформление, выдача, приём денег, заявки воронки и доставки">
        <Table
          minWidth={720}
          head={[
            { label: "Сотрудник" },
            { label: "Оформил", align: "right" },
            { label: "Выдал", align: "right" },
            { label: "Принял оплат", align: "right" },
            { label: "Заявок", align: "right" },
            { label: "Конверсия", align: "right" },
            { label: "Доставок", align: "right" },
          ]}
          rows={data.rows.map((r) => ({
            key: r.name,
            cells: [
              <span key="n" className="font-medium">
                {r.name}
              </span>,
              r.booked,
              r.issued,
              r.payments ? `${r.payments} · ${formatMoney(r.paymentsSum)}` : "—",
              r.leads,
              pct(r.conversion),
              r.deliveries,
            ],
          }))}
          empty="За период никто ничего не оформлял"
        />
        <p className="mt-3 text-[12.5px] text-[var(--color-text-muted)]">
          Аренды, загруженные из старой системы, подписаны «Импорт» и здесь не считаются.
        </p>
      </Card>
    </div>
  );
}

// ─── Риски и долги ──────────────────────────────────────────────────────────

export function RisksSection({ data }: { data: RisksData }) {
  const k = data.kpi;
  const old = data.aging.slice(3).reduce((s, a) => s + a.amount, 0);
  return (
    <div className="space-y-4">
      <Headline
        items={[
          k.debtTotal > 0 && `Клиенты должны ${formatMoney(k.debtTotal)} — ${n(k.debtors, "клиент", "клиента", "клиентов")}.`,
          old > 0 && `${formatMoney(old)} из них висят дольше месяца — такие долги возвращают реже всего.`,
          k.overdue > 0 && `Прямо сейчас ${plural(k.overdue, "просрочена", "просрочены", "просрочено")} ${n(k.overdue, "аренда", "аренды", "аренд")}.`,
          k.stolen > 0 && `За период украли ${n(k.stolen, "аренду", "аренды", "аренд")} на ${formatMoney(k.stolenAmount)}.`,
        ]}
      />
      <Tiles>
        <Tile label="Долг клиентов" value={formatMoney(k.debtTotal)} sub={n(k.debtors, "должник", "должника", "должников")} tone={k.debtTotal ? "danger" : "success"} />
        <Tile label="Просрочено сейчас" value={String(k.overdue)} sub={k.overdueDebt ? `долг ${formatMoney(k.overdueDebt)}` : "без долга"} tone={k.overdue ? "warning" : undefined} />
        <Tile label="Некомплект" value={String(k.shortagesOpen)} sub={`за период +${k.shortagesAdded}, закрыто ${k.shortagesClosed}`} />
        <Tile label="Чёрный список" value={String(k.blacklisted)} sub={`за период +${k.blacklistedAdded}`} />
      </Tiles>
      <Grid2>
        <Card title="Сколько висят долги" hint="Отсчёт от срока возврата">
          <BarList rows={data.aging.map((a) => ({ label: a.label, value: a.amount, display: a.value ? `${a.value} · ${formatMoney(a.amount)}` : "—" }))} />
        </Card>
        <Card title="Главные должники">
          <BarList
            rows={data.topDebtors.map((d) => ({ label: d.label, value: d.value, href: `/clients/${d.id}`, sub: n(d.rentals, "аренда", "аренды", "аренд"), display: formatMoney(d.value) }))}
            empty="Должников нет"
          />
        </Card>
      </Grid2>
    </div>
  );
}
