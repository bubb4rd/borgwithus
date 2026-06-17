import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { scrollToSection } from "../lib/scrollToSection";

export default function HashScroll() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (pathname !== "/" || !hash) return;

    const frame = requestAnimationFrame(() => scrollToSection(hash));
    return () => cancelAnimationFrame(frame);
  }, [pathname, hash]);

  return null;
}
