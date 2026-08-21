"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";

export function PhotoUpload({
  value,
  onChange,
  size = 104,
}: {
  value?: string;
  onChange: (url: string | undefined) => void;
  size?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка загрузки");
      onChange(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        style={{ width: size, height: size }}
        className="relative grid shrink-0 cursor-pointer place-items-center overflow-hidden rounded-[12px] border border-dashed border-[var(--color-border)] text-center transition hover:border-[var(--color-primary)]"
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="Фото" className="h-full w-full object-cover" />
        ) : uploading ? (
          <Loader2 className="h-5 w-5 animate-spin text-[var(--color-primary)]" />
        ) : (
          <div>
            <ImagePlus className="mx-auto mb-1 h-5 w-5 text-[var(--color-primary)]" />
            <div className="text-[11px] font-medium text-[var(--color-primary)]">Фото</div>
          </div>
        )}
        {value && !uploading && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onChange(undefined);
            }}
            className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-white"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      {error && <p className="mt-1 max-w-[104px] text-[10px] text-[#C0272D]">{error}</p>}
    </div>
  );
}
