import { LucideIcon } from "lucide-react";

export function PlaceholderPage({
  icon: Icon,
  title,
  description,
  bullets,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  bullets: string[];
}) {
  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]/70 px-6 py-4 backdrop-blur">
        <h1 className="font-display text-[20px] font-bold">{title}</h1>
        <p className="text-[13px] text-[var(--color-text-muted)]">{description}</p>
      </header>
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="max-w-md rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center card-shadow">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-[14px] bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
            <Icon className="h-6 w-6" />
          </div>
          <h2 className="font-display text-[16px] font-bold">Раздел «{title}» в разработке</h2>
          <p className="mt-1.5 text-[13px] text-[var(--color-text-muted)]">
            Полностью реализованы разделы «Главная» и «Аренды». Этот раздел планируется:
          </p>
          <ul className="mt-3 space-y-1.5 text-left text-[12.5px] text-[var(--color-text-muted)]">
            {bullets.map((b) => (
              <li key={b} className="flex items-start gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--color-primary)]" />
                {b}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
