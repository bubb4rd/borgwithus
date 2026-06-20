import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

let activeLenis: Lenis | null = null;

export function getPublicLenis() {
  return activeLenis;
}

export function enablePublicSiteScroll() {
  document.documentElement.classList.add("public-site");

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return () => {
      document.documentElement.classList.remove("public-site");
    };
  }

  const lenis = new Lenis({
    duration: 1.15,
    smoothWheel: true,
  });

  activeLenis = lenis;

  lenis.on("scroll", ScrollTrigger.update);

  const onTick = (time: number) => {
    lenis.raf(time * 1000);
  };

  gsap.ticker.add(onTick);
  gsap.ticker.lagSmoothing(0);

  return () => {
    document.documentElement.classList.remove("public-site");
    gsap.ticker.remove(onTick);
    lenis.destroy();
    activeLenis = null;
    ScrollTrigger.refresh();
  };
}
