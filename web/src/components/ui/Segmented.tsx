import type { ReactNode } from "react";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

interface SegmentedProps<T extends string> {
  /** Nombre del grupo para lectores de pantalla. */
  label: string;
  value: T;
  options: SegmentOption<T>[];
  onChange: (value: T) => void;
  /** Ocupa todo el ancho y reparte las opciones en partes iguales. */
  fill?: boolean;
}

/** Interruptor de opciones en una píldora; la opción activa va en blanco. */
export function Segmented<T extends string>({ label, value, options, onChange, fill = false }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className={`glass rounded-full p-1 ${fill ? "flex" : "inline-flex"}`}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={`inline-flex h-7 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-[12.5px] ${
              fill ? "flex-1" : ""
            } ${active ? "bg-inverse font-medium text-inverse-fg" : "text-muted hover:text-heading"}`}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
