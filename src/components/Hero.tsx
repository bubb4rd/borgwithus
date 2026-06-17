import { useRef } from "react";
import { Link } from "react-router-dom";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { scrollToSection } from "../lib/scrollToSection";

const entrance = {
  autoAlpha: 0,
  duration: 0.6,
  ease: "power3.out",
  immediateRender: false,
  clearProps: "opacity,visibility,transform",
};

export default function Hero() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.from(".hero-badge", { y: 16, ...entrance, duration: 0.5 })
        .from(".hero-title", { y: 40, ...entrance, duration: 0.8 }, "-=0.2")
        .from(".hero-sub", { y: 24, ...entrance, duration: 0.7 }, "-=0.45")
        .from(
          ".hero-cta-row",
          { y: 20, ...entrance, clearProps: "transform" },
          "-=0.35"
        );
    },
    { scope: sectionRef }
  );

  return (
    <section
      id="hero"
      ref={sectionRef}
      className="flex min-h-screen items-center px-4 pt-28 pb-16 md:px-8"
    >
      <div className="mx-auto w-full max-w-6xl">
        <div className="max-w-3xl">
          <p className="hero-badge mb-6 inline-flex items-center gap-2 rounded-full border border-hazard/25 bg-hazard/5 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.2em] text-muted">
            <svg
              className="h-3.5 w-3.5 shrink-0 text-hazard"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M12 3 2 21h20L12 3z" />
              <path d="M12 9v4" />
              <path d="M12 16v2" />
            </svg>
            Black Out Rage Gallon
          </p>
          <h1 className="hero-title text-5xl font-bold leading-[1.08] text-foreground md:text-6xl lg:text-7xl">
            Generate your <span className="text-hazard">borg.</span>
          </h1>
          <p className="hero-sub mt-6 max-w-xl text-lg text-muted md:text-xl">
            Take your drinking to another level with a BORG!
          </p>
          <div className="hero-cta-row mt-10 flex items-center gap-3 sm:gap-4">
            <Link
              to="/signup"
              className="hero-btn hero-btn-text border-transparent bg-gradient-to-r from-cyan to-sky-400 font-semibold text-on-accent transition-opacity hover:opacity-90"
            >
              Sign up
            </Link>
            <button
              type="button"
              onClick={() => scrollToSection("#generator")}
              className="hero-btn hero-btn-text glass font-semibold text-foreground transition-colors hover:border-cyan/40 hover:bg-hover"
            >
              Let&apos;s BORG
            </button>
            <a
              href="https://instagram.com/borgwithus"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Follow us on Instagram"
              className="hero-btn hero-btn-icon glass text-foreground transition-colors hover:border-magenta/40 hover:text-magenta"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="block"
                aria-hidden
              >
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
