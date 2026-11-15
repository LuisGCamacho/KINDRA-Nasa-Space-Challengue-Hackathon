import type { ReactNode } from "react";
import type { Level } from "@/lib/types";
import { LEVEL_LABEL, LEVEL_STYLE } from "@/lib/colors";
import { cx } from "@/lib/cx";

const BTN =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md border px-3 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40";
/** Clases de botón: se usan igual sobre <button>, <a> o <Link>. */
export const btn = {
  primary: `${BTN} border-foreground bg-foreground text-white hover:bg-ink-2`,
  secondary: `${BTN} border-border bg-background text-foreground hover:bg-hover`,
  ghost: `${BTN} border-transparent text-foreground hover:bg-hover`,
};

export const LABEL = "text-[10.5px] font-medium uppercase tracking-[0.06em] text-muted-foreground";
export const TH = cx(LABEL, "py-2 text-left font-medium");
export const TR = "border-b border-border hover:bg-hover";

export function LevelBadge({ level }: { level: Level }) {
  return <span className={cx("inline-block rounded-sm px-2 py-0.5 text-[11.5px] font-medium", LEVEL_STYLE[level])}>{LEVEL_LABEL[level]}</span>;
}

export function PageHeader({ title, meta, left, right }: { title: string; meta?: string; left?: ReactNode; right?: ReactNode }) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-5">
      <h1 className="text-[15px] font-semibold">{title}</h1>
      {meta && <span className="truncate text-xs text-muted-foreground">{meta}</span>}
      {left && <div className="ml-2 flex items-center gap-2">{left}</div>}
      {right && <div className="ml-auto flex items-center gap-2">{right}</div>}
    </header>
  );
}

/** Cuerpo de las páginas de lectura (todas menos Explorar): columna centrada que se desplaza sola. */
export function Page({ children, width = "max-w-[950px]" }: { children: ReactNode; width?: string }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className={cx("mx-auto px-5 py-8", width)}>{children}</div>
    </div>
  );
}
