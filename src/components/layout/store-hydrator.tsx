"use client";

import { useEffect } from "react";
import { useAppStore } from "@/lib/store";

/** Как часто спрашиваем сервер, не изменилось ли что-нибудь */
const PULSE_MS = 25_000;

/**
 * Загрузка данных и подхват чужой работы.
 *
 * Раньше вкладка показывала снимок на момент открытия: менеджер заводил аренду,
 * а у второго она не появлялась до перезагрузки страницы — и двое могли выдать
 * один инструмент. Теперь вкладка раз в полминуты спрашивает короткий отпечаток
 * состояния базы и перезагружает данные, только если он изменился.
 *
 * Опрос идёт лишь у открытой вкладки: фоновая не тратит ни батарею, ни трафик.
 * При возврате к вкладке проверка делается сразу — это самый частый случай,
 * когда данные успели устареть.
 */
export function StoreHydrator() {
  const hydrate = useAppStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    let stopped = false;
    let lastPulse: string | null = null;

    async function check(force = false) {
      // Скрытая вкладка не тратит трафик. Но первый снимок делаем всегда:
      // без него изменение, случившееся до первой проверки, потерялось бы
      if (stopped || (!force && document.visibilityState !== "visible")) return;
      try {
        const res = await fetch("/api/pulse", { cache: "no-store" });
        if (!res.ok) return;
        const { pulse } = (await res.json()) as { pulse: string };
        if (lastPulse === null) {
          lastPulse = pulse;
          return;
        }
        if (pulse !== lastPulse) {
          lastPulse = pulse;
          await useAppStore.getState().refresh();
          // Разделы, которые грузят своё мимо хранилища (воронка, задачи,
          // доставка), слушают это событие и перечитывают себя сами
          window.dispatchEvent(new CustomEvent("crm:data-changed"));
        }
      } catch {
        // Сеть моргнула — попробуем в следующий раз, молча
      }
    }

    // Снимок сразу при открытии: иначе первая же проверка просто запоминала бы
    // текущее состояние и молча съедала чужие изменения
    check(true);

    const timer = setInterval(() => check(), PULSE_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    // В обычном окне focus приходит вместе с visibilitychange, но если вкладку
    // не переключали, а просто вернулись в окно — сработает только он
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  return null;
}
