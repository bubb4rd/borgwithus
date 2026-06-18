import type { ReactNode } from "react";
import ThemeToggle from "./ThemeToggle";

type HamburgerButtonProps = {
  open: boolean;
  onClick: () => void;
  controlsId: string;
};

export function HamburgerButton({
  open,
  onClick,
  controlsId,
}: HamburgerButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      aria-controls={controlsId}
      aria-label={open ? "Close menu" : "Open menu"}
      className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-border bg-hover text-foreground transition-colors hover:bg-card"
    >
      <span className="relative block h-3.5 w-5" aria-hidden>
        <span
          className={`absolute left-0 top-0 block h-0.5 w-5 rounded-full bg-current transition-transform duration-300 ease-out motion-reduce:transition-none ${
            open ? "translate-y-[0.4375rem] rotate-45" : ""
          }`}
        />
        <span
          className={`absolute left-0 top-1/2 block h-0.5 w-5 -translate-y-1/2 rounded-full bg-current transition-opacity duration-200 motion-reduce:transition-none ${
            open ? "opacity-0" : "opacity-100"
          }`}
        />
        <span
          className={`absolute bottom-0 left-0 block h-0.5 w-5 rounded-full bg-current transition-transform duration-300 ease-out motion-reduce:transition-none ${
            open ? "-translate-y-[0.4375rem] -rotate-45" : ""
          }`}
        />
      </span>
    </button>
  );
}

type MobileNavDrawerProps = {
  id: string;
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer: ReactNode;
};

export function MobileNavDrawer({
  id,
  open,
  onClose,
  title = "Menu",
  children,
  footer,
}: MobileNavDrawerProps) {
  return (
    <div className="md:hidden">
      <div
        className={`fixed inset-0 z-[60] bg-black/50 transition-opacity duration-300 motion-reduce:transition-none ${
          open
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden={!open}
      />

      <aside
        id={id}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        inert={open ? undefined : true}
        className={`fixed right-0 top-0 z-[70] flex h-full w-[min(100%,18rem)] flex-col border-l border-border bg-card shadow-2xl transition-transform duration-300 ease-out motion-reduce:transition-none ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <HamburgerButton
            open
            onClick={onClose}
            controlsId={id}
          />
        </div>

        <nav className="flex-1 overflow-y-auto p-3">{children}</nav>

        <div className="relative flex items-center justify-between gap-3 overflow-visible border-t border-border p-4">
          <ThemeToggle />
          {footer}
        </div>
      </aside>
    </div>
  );
}
