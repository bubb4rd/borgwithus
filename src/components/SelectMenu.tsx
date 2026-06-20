import { useEffect, useId, useRef, useState } from "react";

export type SelectMenuOption<T extends string> = {
  value: T;
  label: string;
};

type SelectMenuProps<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: SelectMenuOption<T>[];
  ariaLabel: string;
  className?: string;
  align?: "left" | "right";
  triggerLabel?: string;
  triggerClassName?: string;
};

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 text-muted transition-transform duration-200 ${
        open ? "rotate-180" : ""
      }`}
      aria-hidden
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export default function SelectMenu<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  className = "",
  align = "left",
  triggerLabel,
  triggerClassName = "text-sm font-bold",
}: SelectMenuProps<T>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const choose = (next: T) => {
    onChange(next);
    setOpen(false);
  };

  const selectedLabel =
    triggerLabel ?? options.find((option) => option.value === value)?.label ?? "";

  return (
    <div ref={rootRef} className={`relative inline-block w-max ${className}`}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => setOpen((current) => !current)}
        className={`inline-flex cursor-pointer items-center gap-1.5 text-left text-foreground transition-colors hover:text-cyan focus:outline-none ${triggerClassName}`}
      >
        <span className="whitespace-nowrap">{selectedLabel}</span>
        <ChevronIcon open={open} />
      </button>

      {open ? (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel}
          className={`absolute z-50 mt-1 max-h-56 w-max min-w-full overflow-auto rounded-md border border-border bg-card py-1 ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <li key={option.value} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => choose(option.value)}
                  className={`w-full cursor-pointer whitespace-nowrap px-3 py-2 text-left text-sm transition-colors ${
                    isSelected
                      ? "font-semibold text-cyan"
                      : "text-foreground hover:bg-hover"
                  }`}
                >
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
