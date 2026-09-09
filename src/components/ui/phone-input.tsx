"use client";

import { formatPhoneInput } from "@/lib/utils";
import { cn } from "@/lib/utils";

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
  return (
    <input
      value={value}
      onChange={(e) => onChange(formatPhoneInput(e.target.value))}
      inputMode="tel"
      autoComplete="tel"
      disabled={disabled}
      autoFocus={autoFocus}
      placeholder={placeholder}
      className={cn("crm-input", className)}
    />
  );
}
