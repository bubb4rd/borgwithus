import gsap from "gsap";
import { getPublicLenis } from "./publicScroll";

const NAV_OFFSET = 64;

export function scrollToSection(target: string) {
  const id = target.startsWith("#") ? target : `#${target}`;
  const el = document.querySelector(id);

  if (!el) return;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const top =
      el.getBoundingClientRect().top + window.scrollY - NAV_OFFSET;
    window.scrollTo({ top, behavior: "auto" });
    return;
  }

  const lenis = getPublicLenis();
  if (lenis) {
    lenis.scrollTo(id, { offset: -NAV_OFFSET, duration: 1.15 });
    return;
  }

  gsap.to(window, {
    duration: 1,
    scrollTo: { y: id, offsetY: NAV_OFFSET },
    ease: "power3.inOut",
  });
}
