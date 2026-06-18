import { useCallback, useEffect, useState } from "react";

export function useMobileMenu() {
  const [open, setOpen] = useState(false);

  const closeMenu = useCallback(() => setOpen(false), []);
  const openMenu = useCallback(() => setOpen(true), []);
  const toggleMenu = useCallback(() => setOpen((value) => !value), []);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, closeMenu]);

  return { open, openMenu, closeMenu, toggleMenu };
}
