"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function QrCode({ value, size = 120 }: { value: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, { width: size, margin: 1, color: { dark: "#1A1A17", light: "#FFFFFF" } }).then((url) => {
      if (!cancelled) setDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (!dataUrl) return <div style={{ width: size, height: size }} className="animate-pulse rounded-[10px] bg-[var(--color-bg)]" />;

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={dataUrl} alt={`QR: ${value}`} width={size} height={size} className="rounded-[10px] border border-[var(--color-border)]" />;
}
