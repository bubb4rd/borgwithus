import gsap from "gsap";

const NAV_OFFSET = 88;

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

  gsap.to(window, {
    duration: 1,
    scrollTo: { y: id, offsetY: NAV_OFFSET },
    ease: "power3.inOut",
  });
}
