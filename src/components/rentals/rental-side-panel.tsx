"use client";

import { Rental, DocumentTemplate, RentalDocument } from "@/lib/types";
import { formatMoney } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import { useAuth } from "@/components/auth/auth-provider";
import { FileText, Printer, ShieldCheck, Receipt, Plus, Undo2, PackageCheck, Siren, Trash2, ExternalLink, CreditCard, Banknote, QrCode, Building2, X, AlertCircle, MessageCircle, Check } from "lucide-react";
import { useEffect, useState } from "react";

type PaymentMethod = "cash" | "kaspi_qr" | "company";
const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Наличные",
  kaspi_qr: "Kaspi QR",
  company: "Оплата компаний",
};
const PAYMENT_METHOD_ICONS: Record<PaymentMethod, React.ElementType> = {
  cash: Banknote,
  kaspi_qr: QrCode,
  company: Building2,
};

function Section({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-4 card-shadow">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-[8px] bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
            <Icon className="h-3.5 w-3.5" />
          </div>
          <h3 className="text-[13.5px] font-semibold">{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

export function RentalSidePanel({ rental }: { rental: Rental }) {
  const remaining = rental.total - rental.paid;
  const { user: sessionUser } = useAuth();
  const [notes, setNotes] = useState<string[]>(rental.comment ? [rental.comment] : []);
  const [draft, setDraft] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // Залог
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositType, setDepositType] = useState<"money" | "equipment" | "document">("money");
  const [savingDeposit, setSavingDeposit] = useState(false);

  // Штраф
  const [showPenaltyModal, setShowPenaltyModal] = useState(false);
  const [penaltyAmount, setPenaltyAmount] = useState("");
  const [penaltyReason, setPenaltyReason] = useState("");
  const [savingPenalty, setSavingPenalty] = useState(false);

  // Расходы
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseType, setExpenseType] = useState("");
  const [savingExpense, setSavingExpense] = useState(false);

  async function saveNote() {
    if (!draft.trim()) return;
    setSavingNote(true);
    const newNote = draft.trim();
    try {
      await updateRental(rental.id, { comment: [...notes, newNote].join("\n") });
      setNotes((n) => [...n, newNote]);
      setDraft("");
    } finally {
      setSavingNote(false);
    }
  }

  async function saveDeposit() {
    const amount = parseFloat(depositAmount);
    if (!amount || amount <= 0) return;
    setSavingDeposit(true);
    try {
      await updateRental(rental.id, { deposit: { type: depositType, amount, returned: false } });
      setShowDepositModal(false);
      setDepositAmount("");
    } finally {
      setSavingDeposit(false);
    }
  }

  async function savePenalty() {
    const amount = parseFloat(penaltyAmount);
    if (!amount || amount <= 0) return;
    setSavingPenalty(true);
    try {
      const existing = rental.penalties ?? [];
      const newPenalties = [...existing, { reason: penaltyReason || "Ручной штраф", amount }];
      await updateRental(rental.id, {
        penalties: newPenalties,
        total: rental.total + amount,
      });
      setShowPenaltyModal(false);
      setPenaltyAmount("");
      setPenaltyReason("");
    } finally {
      setSavingPenalty(false);
    }
  }

  async function saveExpense() {
    const amount = parseFloat(expenseAmount);
    if (!amount || amount <= 0) return;
    setSavingExpense(true);
    try {
      const existing = rental.expenses ?? [];
      const newExpenses = [...existing, { type: expenseType || "Прочее", amount }];
      await updateRental(rental.id, { expenses: newExpenses });
      setShowExpenseModal(false);
      setExpenseAmount("");
      setExpenseType("");
    } finally {
      setSavingExpense(false);
    }
  }
  const updateRental = useAppStore((s) => s.updateRental);
  const [paying, setPaying] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  async function handleAcceptPayment(amount: number, method: PaymentMethod) {
    if (amount <= 0) return;
    const paid = Math.min(rental.total, rental.paid + amount);
    setPaying(true);
    setActionError(null);
    try {
      await updateRental(rental.id, {
        paid,
        paymentStatus: paid >= rental.total ? "paid" : "partial",
      });
      setShowPaymentModal(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Не удалось принять оплату");
    } finally {
      setPaying(false);
    }
  }

  const [issuing, setIssuing] = useState(false);
  const isFullyPaid = rental.paid >= rental.total;
  const canIssue = rental.status === "booked";

  async function handleIssue() {
    setIssuing(true);
    setActionError(null);
    try {
      const patch: Partial<typeof rental> = {
        status: "active",
        issuedBy: sessionUser ? { id: sessionUser.id, name: sessionUser.name, initials: sessionUser.name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase(), role: "" } : undefined,
      };
      // Если не оплачено — отмечаем как долг (попадёт во вкладку «Должники»)
      if (!isFullyPaid) {
        patch.paymentStatus = "overdue";
      }
      await updateRental(rental.id, patch);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Не удалось выдать товар в аренду");
    } finally {
      setIssuing(false);
    }
  }

  const [returning, setReturning] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const canReturn = isFullyPaid && (rental.status === "active" || rental.status === "overdue");
  const updateInventoryItem = useAppStore((s) => s.updateInventoryItem);
  const addWorkshopTicket = useAppStore((s) => s.addWorkshopTicket);

  // Состояние для каждого товара: выбран ли + его состояние
  type ItemCondition = "ok" | "maintenance" | "repair";
  const [returnItems, setReturnItems] = useState<Map<string, { selected: boolean; condition: ItemCondition }>>(
    () => new Map(rental.items.filter((i) => i.inventoryItemId).map((i) => [i.inventoryItemId!, { selected: false, condition: "ok" }]))
  );

  function toggleReturnItem(id: string) {
    setReturnItems((prev) => {
      const next = new Map(prev);
      const cur = next.get(id);
      if (cur) next.set(id, { ...cur, selected: !cur.selected });
      return next;
    });
  }

  function setReturnCondition(id: string, condition: ItemCondition) {
    setReturnItems((prev) => {
      const next = new Map(prev);
      const cur = next.get(id);
      if (cur) next.set(id, { ...cur, condition });
      return next;
    });
  }

  async function handleReturn() {
    const toReturn = rental.items.filter((i) => i.inventoryItemId && returnItems.get(i.inventoryItemId)?.selected);
    if (toReturn.length === 0) return;

    setReturning(true);
    setActionError(null);
    try {
      for (const item of toReturn) {
        if (!item.inventoryItemId) continue;
        const { condition } = returnItems.get(item.inventoryItemId)!;
        await updateInventoryItem(item.inventoryItemId, {
          status: condition === "ok" ? "available" : condition,
        });
        if (condition !== "ok") {
          await addWorkshopTicket({
            inventoryItemId: item.inventoryItemId,
            reason: condition,
            title: condition === "maintenance" ? "Профилактика после возврата" : "Ремонт после возврата",
            description: `Заявка создана автоматически из аренды ${rental.number}`,
            sourceRentalId: rental.id,
            lines: [],
          });
        }
      }
      // Если все товары возвращены — завершаем аренду, иначе оставляем активной
      const allItems = rental.items.filter((i) => i.inventoryItemId);
      const allReturned = allItems.every((i) => returnItems.get(i.inventoryItemId!)?.selected);
      if (allReturned) {
        await updateRental(rental.id, { status: "completed" });
      }
      setShowReturnModal(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Не удалось оформить возврат товара");
    } finally {
      setReturning(false);
    }
  }

  const [marking, setMarking] = useState(false);
  const [showStolenModal, setShowStolenModal] = useState(false);
  const [showStolenReturnModal, setShowStolenReturnModal] = useState(false);
  const [stolenReturning, setStolenReturning] = useState(false);
  const canMarkStolen = rental.status === "active" || rental.status === "overdue";
  const updateClient = useAppStore((s) => s.updateClient);

  async function handleStolenReturn(removeFromBlacklist: boolean) {
    setStolenReturning(true);
    setActionError(null);
    try {
      // Возвращаем товары в каталог (требуют проверки)
      for (const item of rental.items) {
        if (!item.inventoryItemId) continue;
        await updateInventoryItem(item.inventoryItemId, { status: "repair" });
      }
      // Завершаем аренду
      await updateRental(rental.id, { status: "completed" });
      // Убираем из ЧС если выбрано
      if (removeFromBlacklist) {
        await updateClient(rental.client.id, { blacklisted: false });
      }
      setShowStolenReturnModal(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Ошибка при оформлении возврата");
    } finally {
      setStolenReturning(false);
    }
  }

  async function handleMarkStolen() {
    setMarking(true);
    setActionError(null);
    try {
      for (const item of rental.items) {
        if (!item.inventoryItemId) continue;
        await updateInventoryItem(item.inventoryItemId, { status: "stolen" });
      }
      await updateRental(rental.id, { status: "stolen" });
      if (!rental.client.blacklisted) {
        await updateClient(rental.client.id, { blacklisted: true });
      }
      setShowStolenModal(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Не удалось отметить аренду как украденную");
    } finally {
      setMarking(false);
    }
  }

  return (
    <div className="w-[340px] shrink-0 space-y-4">
      {canIssue && (
        <div className="space-y-1.5">
          {!isFullyPaid && (
            <div className="rounded-[10px] border border-[#FFDCA8] bg-[#FFF8EA] px-3 py-2 text-[12px] font-medium text-[#B8620A]">
              Есть неоплаченный остаток {formatMoney(rental.total - rental.paid)} — клиент попадёт в «Должники»
            </div>
          )}
          <button
            onClick={handleIssue}
            disabled={issuing}
            className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-card)] bg-[var(--color-primary)] py-3.5 text-[14px] font-semibold text-white transition hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
          >
            <PackageCheck className="h-4 w-4" />
            {issuing ? "Выдаём…" : "Выдать в аренду"}
          </button>
        </div>
      )}
      {rental.status === "booked" && !isFullyPaid && !canIssue && (
        <div className="rounded-[var(--radius-card)] border border-[#FFDCA8] bg-[#FFF8EA] p-3 text-[12.5px] font-medium text-[#B8620A]">
          После полной оплаты появится кнопка «Выдать в аренду».
        </div>
      )}
      {rental.status === "stolen" && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 rounded-[var(--radius-card)] border border-[#5C1A1A] bg-[#2A0E0E] p-3 text-[12.5px] font-semibold text-[#FF6B6B]">
            <Siren className="h-4 w-4 shrink-0" />
            Товар отмечен украденным, клиент в чёрном списке
          </div>
          <button
            onClick={() => setShowStolenReturnModal(true)}
            className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-card)] border border-[#10B981] bg-white py-2.5 text-[13px] font-semibold text-[#10B981] transition hover:bg-[#EAF7EE]"
          >
            <Undo2 className="h-4 w-4" /> Товар возвращён клиентом
          </button>
        </div>
      )}
      {canMarkStolen && (
        <button
          onClick={() => setShowStolenModal(true)}
          className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-card)] border border-[#F3B7B7] bg-white py-2.5 text-[13px] font-semibold text-[#C0272D] transition hover:bg-[#FDECEC]"
        >
          <Siren className="h-4 w-4" /> Украдено
        </button>
      )}
      {actionError && (
        <div className="rounded-[10px] border border-[#F3B7B7] bg-[#FDECEC] px-3 py-2 text-[12.5px] font-medium text-[#C0272D]">
          {actionError}
        </div>
      )}
      {/* Payment */}
      <Section icon={Receipt} title="К оплате">
        {/* Строки сумм */}
        <div className="space-y-1.5 text-[13px]">
          <div className="flex items-center justify-between">
            <span className="text-[var(--color-text-muted)]">Инвентарь</span>
            <span className="font-medium">{formatMoney(rental.total)}</span>
          </div>
          <div className="border-t border-[var(--color-border)] pt-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold">Итого</span>
              <span className="font-bold">{formatMoney(rental.total)}</span>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-[8px] bg-[var(--color-bg)] px-2.5 py-2">
            <span className="text-[12.5px] font-semibold text-[var(--color-text-muted)]">К оплате</span>
            <span className={`text-[15px] font-bold ${remaining > 0 ? "text-[#C0272D]" : "text-[#1C8A46]"}`}>
              {formatMoney(remaining)}
            </span>
          </div>
          {rental.paid > 0 && remaining > 0 && (
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-[var(--color-text-muted)]">Уже оплачено</span>
              <span className="font-medium text-[#1C8A46]">{formatMoney(rental.paid)}</span>
            </div>
          )}
        </div>

        {remaining > 0 ? (
          <button
            onClick={() => setShowPaymentModal(true)}
            disabled={paying}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-[10px] bg-[#1C8A46] py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#167A3C] disabled:opacity-60"
          >
            <CreditCard className="h-4 w-4" />
            {paying ? "Оплата…" : `Принять оплату +`}
          </button>
        ) : (
          <div className="mt-3 rounded-[10px] bg-[#EAF7EE] py-2.5 text-center text-[13px] font-semibold text-[#1C8A46]">
            ✓ Оплачено полностью
          </div>
        )}

        <div className="mt-2 grid grid-cols-2 gap-2">
          <button className="rounded-[10px] border border-[var(--color-border)] py-2 text-[12.5px] font-medium text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg)]">
            Скидка
          </button>
          <button className="rounded-[10px] border border-[var(--color-border)] py-2 text-[12.5px] font-medium text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg)]">
            Возврат средств
          </button>
        </div>
        {canReturn && (
          <button
            onClick={() => setShowReturnModal(true)}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-[var(--color-primary)] py-2.5 text-[13px] font-semibold text-[var(--color-primary)] transition hover:bg-[var(--color-primary-soft)]"
          >
            <Undo2 className="h-3.5 w-3.5" /> Возврат товара
          </button>
        )}
      </Section>

      {/* Модалка оплаты */}
      {/* Модалка залога */}
      {showDepositModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-[360px] rounded-[16px] bg-white p-5 card-shadow">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[15px] font-semibold">Добавить залог</h3>
              <button onClick={() => setShowDepositModal(false)} className="grid h-7 w-7 place-items-center rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-[12px] font-medium text-[var(--color-text-muted)]">Тип залога</span>
                <select value={depositType} onChange={(e) => setDepositType(e.target.value as typeof depositType)} className="crm-input">
                  <option value="money">Денежный</option>
                  <option value="equipment">Оборудование</option>
                  <option value="document">Документ</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[12px] font-medium text-[var(--color-text-muted)]">Сумма, ₸</span>
                <input autoFocus type="number" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} className="crm-input" placeholder="0" min={0} />
              </label>
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setShowDepositModal(false)} className="flex-1 rounded-[10px] border border-[var(--color-border)] py-2 text-[13px] hover:bg-[var(--color-bg)]">Отмена</button>
              <button onClick={saveDeposit} disabled={savingDeposit || !depositAmount} className="flex-1 rounded-[10px] bg-[var(--color-primary)] py-2 text-[13px] font-semibold text-white disabled:opacity-50 hover:bg-[var(--color-primary-hover)]">
                {savingDeposit ? "Сохранение…" : "Добавить"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модалка штрафа */}
      {showPenaltyModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-[360px] rounded-[16px] bg-white p-5 card-shadow">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[15px] font-semibold">Ручной штраф</h3>
              <button onClick={() => setShowPenaltyModal(false)} className="grid h-7 w-7 place-items-center rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-[12px] font-medium text-[var(--color-text-muted)]">Причина</span>
                <input autoFocus value={penaltyReason} onChange={(e) => setPenaltyReason(e.target.value)} className="crm-input" placeholder="Повреждение, утеря и т.д." />
              </label>
              <label className="block">
                <span className="mb-1 block text-[12px] font-medium text-[var(--color-text-muted)]">Сумма штрафа, ₸</span>
                <input type="number" value={penaltyAmount} onChange={(e) => setPenaltyAmount(e.target.value)} className="crm-input" placeholder="0" min={0} />
              </label>
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setShowPenaltyModal(false)} className="flex-1 rounded-[10px] border border-[var(--color-border)] py-2 text-[13px] hover:bg-[var(--color-bg)]">Отмена</button>
              <button onClick={savePenalty} disabled={savingPenalty || !penaltyAmount} className="flex-1 rounded-[10px] bg-[#C0272D] py-2 text-[13px] font-semibold text-white disabled:opacity-50 hover:bg-[#A31F24]">
                {savingPenalty ? "Сохранение…" : "Добавить штраф"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модалка расхода */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-[360px] rounded-[16px] bg-white p-5 card-shadow">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[15px] font-semibold">Добавить расход</h3>
              <button onClick={() => setShowExpenseModal(false)} className="grid h-7 w-7 place-items-center rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-[12px] font-medium text-[var(--color-text-muted)]">Тип расхода</span>
                <input autoFocus value={expenseType} onChange={(e) => setExpenseType(e.target.value)} className="crm-input" placeholder="Доставка, ремонт и т.д." />
              </label>
              <label className="block">
                <span className="mb-1 block text-[12px] font-medium text-[var(--color-text-muted)]">Сумма, ₸</span>
                <input type="number" value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} className="crm-input" placeholder="0" min={0} />
              </label>
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setShowExpenseModal(false)} className="flex-1 rounded-[10px] border border-[var(--color-border)] py-2 text-[13px] hover:bg-[var(--color-bg)]">Отмена</button>
              <button onClick={saveExpense} disabled={savingExpense || !expenseAmount} className="flex-1 rounded-[10px] bg-[var(--color-primary)] py-2 text-[13px] font-semibold text-white disabled:opacity-50 hover:bg-[var(--color-primary-hover)]">
                {savingExpense ? "Сохранение…" : "Добавить"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showStolenReturnModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-[400px] overflow-hidden rounded-[20px] bg-white card-shadow">
            {/* Шапка */}
            <div className="bg-[#EAF7EE] px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#1C8A46]/20">
                  <Undo2 className="h-5 w-5 text-[#1C8A46]" />
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-[#1C8A46]">Товар возвращён клиентом</h3>
                  <p className="text-[12px] text-[#1C8A46]/70">Аренда будет завершена, товар отправлен на проверку</p>
                </div>
              </div>
            </div>

            {/* Клиент */}
            <div className="border-b border-[var(--color-border)] px-5 py-3">
              <div className="flex items-center gap-2.5">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#FDECEC] text-[11px] font-bold text-[#C0272D]">
                  {rental.client.name.split(" ").slice(0, 2).map((n) => n[0]).join("")}
                </div>
                <div>
                  <div className="text-[13px] font-semibold">{rental.client.name}</div>
                  <div className="flex items-center gap-1 text-[11.5px] text-[#C0272D]">
                    <Siren className="h-3 w-3" /> Клиент в чёрном списке
                  </div>
                </div>
              </div>
            </div>

            {/* Вопрос о ЧС */}
            <div className="px-5 py-4">
              <p className="text-[13px] font-semibold">Убрать клиента из чёрного списка?</p>
              <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                Товар был отмечен украденным. Клиент вернул его — решите, снять ли с него ограничения.
              </p>

              <div className="mt-4 space-y-2">
                <button
                  onClick={() => handleStolenReturn(true)}
                  disabled={stolenReturning}
                  className="w-full rounded-[12px] bg-[#1C8A46] py-3 text-[13px] font-semibold text-white transition hover:bg-[#167A3C] disabled:opacity-60"
                >
                  {stolenReturning ? "Оформляем…" : "Да, убрать из чёрного списка"}
                </button>
                <button
                  onClick={() => handleStolenReturn(false)}
                  disabled={stolenReturning}
                  className="w-full rounded-[12px] border-2 border-[#C0272D] bg-white py-3 text-[13px] font-semibold text-[#C0272D] transition hover:bg-[#FDECEC] disabled:opacity-60"
                >
                  Нет, оставить в чёрном списке
                </button>
                <button
                  onClick={() => setShowStolenReturnModal(false)}
                  disabled={stolenReturning}
                  className="w-full rounded-[12px] py-2 text-[12.5px] text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg)]"
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPaymentModal && (
        <PaymentModal
          remaining={remaining}
          onPay={handleAcceptPayment}
          onClose={() => setShowPaymentModal(false)}
          paying={paying}
        />
      )}

      {/* Documents */}
      <DocumentsSection rental={rental} />

      {/* Deposit */}
      <Section icon={ShieldCheck} title="Залог">
        {rental.deposit ? (
          <div className="space-y-1.5 text-[13px]">
            <Row label="Тип" value={depositLabel(rental.deposit.type)} />
            {rental.deposit.amount && <Row label="Сумма" value={formatMoney(rental.deposit.amount)} />}
            <Row
              label="Статус возврата"
              value={rental.deposit.returned ? "Возвращён" : "Удержан"}
              valueClass={rental.deposit.returned ? "text-[#1C8A46]" : "text-[#B8860B]"}
            />
          </div>
        ) : (
          <p className="text-[12.5px] text-[var(--color-text-muted)]">Залог не добавлен</p>
        )}
        <button onClick={() => setShowDepositModal(true)} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-[var(--color-border)] py-2 text-[12.5px] font-medium text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg)]">
          <Plus className="h-3.5 w-3.5" /> Добавить залог
        </button>
      </Section>

      {/* Penalties */}
      <Section icon={AlertCircle} title="Штрафы">
        {rental.penalties && rental.penalties.length > 0 ? (
          <div className="space-y-1.5">
            {rental.penalties.map((p, i) => (
              <Row key={i} label={p.reason} value={formatMoney(p.amount)} valueClass="text-[#C0272D]" />
            ))}
          </div>
        ) : (
          <p className="text-[12.5px] text-[var(--color-text-muted)]">Штрафов нет</p>
        )}
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button className="rounded-[10px] border border-[var(--color-border)] py-2 text-[12.5px] font-medium text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg)]">
            Авто-штраф
          </button>
          <button onClick={() => setShowPenaltyModal(true)} className="rounded-[10px] border border-[var(--color-border)] py-2 text-[12.5px] font-medium text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg)]">
            Ручной штраф
          </button>
        </div>
      </Section>

      {/* Expenses */}
      <Section icon={Receipt} title="Расходы">
        {rental.expenses && rental.expenses.length > 0 ? (
          <div className="space-y-1.5">
            {rental.expenses.map((e, i) => (
              <Row key={i} label={e.type} value={formatMoney(e.amount)} />
            ))}
          </div>
        ) : (
          <p className="text-[12.5px] text-[var(--color-text-muted)]">Расходов нет</p>
        )}
        <button onClick={() => setShowExpenseModal(true)} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-[var(--color-border)] py-2 text-[12.5px] font-medium text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg)]">
          <Plus className="h-3.5 w-3.5" /> Добавить расход
        </button>
      </Section>

      {/* Notes */}
      <Section icon={MessageCircle} title="Заметки">
        <div className="space-y-2">
          {notes.map((n, i) => (
            <div key={i} className="rounded-[10px] bg-[var(--color-bg)] px-3 py-2 text-[12.5px]">{n}</div>
          ))}
          {notes.length === 0 && <p className="text-[12.5px] text-[var(--color-text-muted)]">Комментариев нет</p>}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveNote()}
            placeholder="Написать комментарий…"
            className="flex-1 rounded-[10px] border border-[var(--color-border)] px-3 py-2 text-[12.5px] outline-none focus:border-[var(--color-primary)]"
          />
          <button
            onClick={saveNote}
            disabled={savingNote || !draft.trim()}
            className="rounded-[10px] bg-[var(--color-primary)] px-3 text-[12.5px] font-semibold text-white transition hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
          >
            +
          </button>
        </div>
      </Section>

      {showReturnModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4">
          <div className="w-full max-w-[440px] overflow-hidden rounded-[16px] bg-white card-shadow" style={{ maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
            {/* Шапка */}
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4 shrink-0">
              <div>
                <h3 className="text-[15px] font-semibold">Возврат товара</h3>
                <p className="text-[12px] text-[var(--color-text-muted)]">Выберите товары и отметьте состояние каждого</p>
              </div>
              <button onClick={() => setShowReturnModal(false)} className="grid h-7 w-7 place-items-center rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Список товаров */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {rental.items.filter((i) => i.inventoryItemId).map((item) => {
                const state = returnItems.get(item.inventoryItemId!);
                if (!state) return null;
                return (
                  <div key={item.inventoryItemId} className={`rounded-[12px] border transition ${state.selected ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)]" : "border-[var(--color-border)] bg-white"}`}>
                    {/* Строка товара с чекбоксом */}
                    <button
                      onClick={() => toggleReturnItem(item.inventoryItemId!)}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
                    >
                      <div className={`grid h-5 w-5 shrink-0 place-items-center rounded-[5px] border-2 transition ${state.selected ? "border-[var(--color-primary)] bg-[var(--color-primary)]" : "border-[var(--color-border)]"}`}>
                        {state.selected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-medium">{item.name}</div>
                        <div className="text-[11.5px] text-[var(--color-text-muted)]">{item.qty} шт · {formatMoney(item.pricePerDay)}/сут</div>
                      </div>
                    </button>

                    {/* Состояние — только если выбран */}
                    {state.selected && (
                      <div className="border-t border-[var(--color-primary)]/20 px-3 pb-3 pt-2">
                        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Состояние</p>
                        <div className="flex gap-1.5">
                          {([
                            { value: "ok", label: "Исправен", color: "text-[#1C8A46]", activeBg: "bg-[#EAF7EE] border-[#1C8A46]" },
                            { value: "maintenance", label: "Профилактика", color: "text-[#B8860B]", activeBg: "bg-[#FFF8EA] border-[#B8860B]" },
                            { value: "repair", label: "Ремонт", color: "text-[#C0272D]", activeBg: "bg-[#FDECEC] border-[#C0272D]" },
                          ] as const).map((opt) => (
                            <button
                              key={opt.value}
                              onClick={(e) => { e.stopPropagation(); setReturnCondition(item.inventoryItemId!, opt.value); }}
                              className={`flex-1 rounded-[8px] border py-1.5 text-[11.5px] font-semibold transition ${state.condition === opt.value ? `${opt.activeBg} ${opt.color}` : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]"}`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Футер */}
            <div className="border-t border-[var(--color-border)] p-4 shrink-0">
              {(() => {
                const selectedCount = Array.from(returnItems.values()).filter((s) => s.selected).length;
                const totalCount = rental.items.filter((i) => i.inventoryItemId).length;
                const allSelected = selectedCount === totalCount;
                return (
                  <>
                    {selectedCount > 0 && selectedCount < totalCount && (
                      <p className="mb-2 text-center text-[12px] text-[#B8620A]">
                        ⚠ Частичный возврат — аренда останется активной
                      </p>
                    )}
                    <button
                      onClick={handleReturn}
                      disabled={returning || selectedCount === 0}
                      className="w-full rounded-[10px] bg-[var(--color-primary)] py-2.5 text-[13px] font-semibold text-white transition hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
                    >
                      {returning ? "Оформляем…" : selectedCount === 0 ? "Выберите товары" : `Принять ${selectedCount} из ${totalCount} товар${selectedCount > 1 ? "ов" : "а"}${allSelected ? " и завершить аренду" : ""}`}
                    </button>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {showStolenModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4">
          <div className="w-full max-w-[380px] rounded-[16px] bg-white p-5 card-shadow">
            <div className="flex items-center gap-2 text-[#C0272D]">
              <Siren className="h-5 w-5" />
              <h3 className="text-[15px] font-semibold">Отметить как украденное?</h3>
            </div>
            <p className="mt-2 text-[12.5px] text-[var(--color-text-muted)]">
              Инструмент(ы) из этой аренды будут списаны из каталога (статус «Украден»), аренда получит статус
              «Украдено», а клиент <span className="font-semibold text-[var(--color-text)]">{rental.client.name}</span>{" "}
              автоматически попадёт в чёрный список. Действие можно отменить только вручную.
            </p>
            <div className="mt-4 space-y-2">
              <button
                onClick={handleMarkStolen}
                disabled={marking}
                className="w-full rounded-[10px] bg-[#C0272D] py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#A31F24] disabled:opacity-60"
              >
                {marking ? "Отмечаем…" : "Да, отметить украденным"}
              </button>
              <button
                onClick={() => setShowStolenModal(false)}
                disabled={marking}
                className="w-full rounded-[10px] py-2 text-[12.5px] font-medium text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg)]"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function depositLabel(type: string) {
  return { money: "Деньги", document: "Документ", equipment: "Техника", other: "Другое" }[type] ?? type;
}

function parseMoneyAmount(input: string | null) {
  if (input === null) return null;
  const normalized = input.replace(/\s/g, "").replace(",", ".").replace(/[^\d.]/g, "");
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : 0;
}

function DocumentsSection({ rental }: { rental: Rental }) {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [docs, setDocs] = useState<RentalDocument[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<RentalDocument | null>(null);
  const [generating, setGenerating] = useState(false);

  async function loadDocs() {
    const res = await fetch(`/api/rental-documents?rentalId=${rental.id}`);
    if (res.ok) setDocs(await res.json());
  }

  useEffect(() => {
    fetch("/api/document-templates").then((r) => r.json()).then(setTemplates);
    loadDocs();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rental.id]);

  async function generate(templateId: string) {
    setGenerating(true);
    const res = await fetch("/api/rental-documents", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rentalId: rental.id, templateId }),
    });
    if (res.ok) { await loadDocs(); }
    setShowPicker(false);
    setGenerating(false);
  }

  async function deleteDoc(id: string) {
    await fetch(`/api/rental-documents/${id}`, { method: "DELETE" });
    setDocs((prev) => prev.filter((d) => d.id !== id));
  }

  function printDoc(body: string) {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Документ</title></head><body>${body}</body></html>`);
    w.document.close();
    w.print();
  }

  return (
    <>
      <Section icon={FileText} title="Документы" action={
        <button onClick={() => setShowPicker(true)} className="grid h-6 w-6 place-items-center rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]" title="Добавить документ">
          <Plus className="h-4 w-4" />
        </button>
      }>
        {docs.length === 0 ? (
          <button onClick={() => setShowPicker(true)} className="flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-[var(--color-border)] py-2 text-[12.5px] font-medium text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg)]">
            <Plus className="h-3.5 w-3.5" /> Добавить документ
          </button>
        ) : (
          <div className="space-y-1.5">
            {docs.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between rounded-[10px] border border-[var(--color-border)] px-3 py-2 text-[12.5px]">
                <button onClick={() => setPreviewDoc(doc)} className="truncate text-left font-medium hover:text-[var(--color-primary)] hover:underline">{doc.name}</button>
                <div className="flex shrink-0 items-center gap-1 text-[var(--color-text-muted)]">
                  <button onClick={() => setPreviewDoc(doc)} className="grid h-6 w-6 place-items-center rounded-md hover:bg-[var(--color-bg)]" title="Просмотр"><ExternalLink className="h-3.5 w-3.5" /></button>
                  <button onClick={() => printDoc(doc.body)} className="grid h-6 w-6 place-items-center rounded-md hover:bg-[var(--color-bg)]" title="Печать"><Printer className="h-3.5 w-3.5" /></button>
                  <button onClick={() => deleteDoc(doc.id)} className="grid h-6 w-6 place-items-center rounded-md hover:bg-[#FDECEC] hover:text-[#C0272D]" title="Удалить"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            ))}
            <button onClick={() => setShowPicker(true)} className="flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-[var(--color-border)] py-1.5 text-[12px] text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg)]">
              <Plus className="h-3.5 w-3.5" /> Ещё документ
            </button>
          </div>
        )}
      </Section>

      {showPicker && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-[16px] bg-white p-5 card-shadow">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[15px] font-semibold">Выберите шаблон</h3>
              <button onClick={() => setShowPicker(false)} className="grid h-7 w-7 place-items-center rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]"><span className="text-[18px]">×</span></button>
            </div>
            {templates.length === 0 ? (
              <p className="text-[12.5px] text-[var(--color-text-muted)]">Нет шаблонов. Создайте их в разделе <a href="/documents" className="text-[var(--color-primary)] underline">Документы</a>.</p>
            ) : (
              <div className="space-y-2">
                {templates.map((t) => (
                  <button key={t.id} onClick={() => generate(t.id)} disabled={generating} className="flex w-full items-center gap-3 rounded-[10px] border border-[var(--color-border)] px-3 py-2.5 text-left transition hover:bg-[var(--color-primary-soft)] hover:border-[var(--color-primary)] disabled:opacity-60">
                    <FileText className="h-4 w-4 shrink-0 text-[var(--color-primary)]" />
                    <span className="text-[13px] font-medium">{t.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-8" onClick={() => setPreviewDoc(null)}>
          <div className="w-full max-w-3xl rounded-[16px] bg-white card-shadow" style={{ maxHeight: "90vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3">
              <span className="text-[14px] font-semibold">{previewDoc.name}</span>
              <div className="flex items-center gap-2">
                <button onClick={() => printDoc(previewDoc.body)} className="flex items-center gap-1.5 rounded-[8px] border border-[var(--color-border)] px-3 py-1.5 text-[12.5px] hover:bg-[var(--color-bg)]">
                  <Printer className="h-3.5 w-3.5" /> Печать
                </button>
                <button onClick={() => setPreviewDoc(null)} className="grid h-7 w-7 place-items-center rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]"><span className="text-[18px]">×</span></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6" dangerouslySetInnerHTML={{ __html: previewDoc.body }} />
          </div>
        </div>
      )}
    </>
  );
}

// ─── Модалка оплаты ──────────────────────────────────────────────────────────

function PaymentModal({ remaining, onPay, onClose, paying }: {
  remaining: number;
  onPay: (amount: number, method: PaymentMethod) => Promise<void>;
  onClose: () => void;
  paying: boolean;
}) {
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [amountStr, setAmountStr] = useState(String(remaining));
  const amount = parseFloat(amountStr.replace(/\s/g, "").replace(",", ".")) || 0;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-[380px] overflow-hidden rounded-[20px] bg-white card-shadow">
        {/* Шапка */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <h3 className="text-[15px] font-bold">Оплатить сейчас</h3>
          <button onClick={onClose} className="grid h-7 w-7 place-items-center rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Тип оплаты */}
          <div>
            <p className="mb-2 text-[12px] font-semibold text-[var(--color-text-muted)]">
              Тип оплаты <span className="text-[#C0272D]">*</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {(["company", "cash", "kaspi_qr"] as PaymentMethod[]).map((m) => {
                const Icon = PAYMENT_METHOD_ICONS[m];
                return (
                  <button
                    key={m}
                    onClick={() => setMethod(m)}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium transition border ${
                      method === m
                        ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
                        : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {PAYMENT_METHOD_LABELS[m]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Сумма */}
          <div>
            <p className="mb-1.5 text-[12px] font-semibold text-[var(--color-text-muted)]">
              Сумма оплаты <span className="text-[#C0272D]">*</span>
            </p>
            <input
              type="number"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              className="crm-input text-[16px] font-semibold"
              placeholder="0"
              min={0}
              max={remaining}
            />
          </div>

          {/* Добавить способ оплаты */}
          <button className="flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--color-primary)] hover:underline">
            <Plus className="h-3.5 w-3.5" /> Добавить способ оплаты
          </button>
        </div>

        {/* Кнопка */}
        <div className="border-t border-[var(--color-border)] px-5 py-4">
          <button
            onClick={() => onPay(amount, method)}
            disabled={paying || amount <= 0}
            className="flex w-full items-center justify-center gap-2 rounded-[12px] bg-[var(--color-primary)] py-3 text-[14px] font-semibold text-white transition hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
          >
            {paying ? "Оплата…" : `Принять оплату ${amount > 0 ? formatMoney(amount) : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold, valueClass }: { label: string; value: string; bold?: boolean; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[var(--color-text-muted)]">{label}</span>
      <span className={`${bold ? "font-semibold" : ""} ${valueClass ?? ""}`}>{value}</span>
    </div>
  );
}
