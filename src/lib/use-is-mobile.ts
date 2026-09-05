"use client";

import { useEffect, useState } from "react";

const PHONE_UA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Windows Phone/i;

/**
 * Зашли с телефона или планшета.
 *
 * Определяем ИМЕННО устройство, а не ширину окна: на компьютере интерфейс должен
 * остаться прежним, даже если окно браузера сузили. Поэтому проверяем
 * user-agent и тип указателя, а не media-запрос по ширине.
 *
 * До монтирования возвращает false — сервер не знает, с чего зашли, а расхождение
 * разметки ломает гидратацию.
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const update = () => {
      const isPhoneUA = PHONE_UA.test(navigator.userAgent);

      // iPadOS 13+ представляется как Mac — отличаем по мультитачу
      const isIPadOS = navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent);

      // Основной указатель — палец, и мыши в системе нет вообще.
      // Ноутбук с сенсорным экраном сюда не попадает: у него есть точный указатель.
      const touchOnly =
        window.matchMedia("(pointer: coarse)").matches && !window.matchMedia("(any-pointer: fine)").matches;

      setIsMobile(isPhoneUA || isIPadOS || touchOnly);
    };

    update();
    window.addEventListener("orientationchange", update);
    return () => window.removeEventListener("orientationchange", update);
  }, []);

  return isMobile;
}
