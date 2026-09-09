"use client";

import { cn, formatPhoneInput } from "@/lib/utils";

/**
 * Поле телефона с маской.
 *
 * Номер приводится к единому виду прямо при вводе: менеджеры набирают его
 * как придётся — «87071234567», «7071234567», «+7 707 123 45 67», — а потом по
 * этому номеру ищут клиента и не находят. Одно поле на всю систему, чтобы правила
 * не разъезжались между формой клиента, заявкой и настройками.
 */
export function PhoneInput({
  value,
  onChange,
  className,
  placeholder = "+7 (___) ___-__-__",
  disabled,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  /**
   * Маска дорисовывает скобки и дефисы, и на удалении это оборачивается против
   * пользователя: он стирает «)» или пробел, маска ставит их обратно, цифр не
   * убавляется — со стороны выглядит, будто backspace не работает.
   *
   * Ловим это по результату: если при удалении отформатированное значение не
   * изменилось, значит стёрли разделитель — убираем цифру перед ним.
   */
  function handle(next: string) {
    const deleting = next.length < value.length;
    const formatted = formatPhoneInput(next);
    if (deleting && formatted === value) {
      onChange(formatPhoneInput(next.replace(/\D+$/, "").slice(0, -1)));
      return;
    }
    onChange(formatted);
  }

  return (
    <input
      value={value}
      onChange={(e) => handle(e.target.value)}
      inputMode="tel"
      autoComplete="tel"
      disabled={disabled}
      autoFocus={autoFocus}
      placeholder={placeholder}
      className={cn("crm-input", className)}
    />
  );
}
