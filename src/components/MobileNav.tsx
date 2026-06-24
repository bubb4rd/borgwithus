import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
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
  children: ReactNode;
  footer: ReactNode;
};

function MobileNavWordmark() {
  return (
    <p className="text-lg font-semibold tracking-tight text-foreground">
      borg<span className="text-cyan">with</span>us
    </p>
  );
}

export function MobileNavDrawer({
  id,
  open,
  onClose,
  children,
  footer,
}: MobileNavDrawerProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className="md:hidden">
      <aside
        id={id}
        role="dialog"
        aria-modal="true"
        aria-label="borgwithus"
        aria-hidden={!open}
        inert={open ? undefined : true}
        className={`mobile-nav-drawer fixed inset-0 z-[70] flex h-dvh max-h-dvh min-h-0 w-full flex-col border-border bg-card/95 shadow-2xl backdrop-blur-3xl backdrop-brightness-90 motion-reduce:transition-none supports-[backdrop-filter]:bg-card/85 ${
          open
            ? "translate-x-0 opacity-100"
            : "pointer-events-none translate-x-full opacity-0"
        }`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <MobileNavWordmark />
          <HamburgerButton open onClick={onClose} controlsId={id} />
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 pb-4">
          {children}
        </nav>

        <div className="relative flex shrink-0 items-center justify-between gap-3 overflow-visible border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <ThemeToggle />
          {footer}
        </div>
      </aside>
    </div>,
    document.body
  );
}
