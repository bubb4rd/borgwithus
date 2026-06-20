import { useRef } from "react";
import { Link } from "react-router-dom";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useAuth } from "../context/AuthContext";
import { scrollToSection } from "../lib/scrollToSection";

const entrance = {
  autoAlpha: 0,
  duration: 0.6,
  ease: "power3.out",
  immediateRender: false,
  clearProps: "opacity,visibility,transform",
};

function HeroMediaPlaceholder() {
  return (
    <div
      className="hero-media mx-auto flex aspect-[4/5] w-[85.75%] min-h-[18.85rem] flex-col items-center justify-center gap-4 overflow-hidden rounded-3xl border border-dashed border-border bg-elevated/80 text-subtle sm:min-h-[22.25rem] lg:aspect-[3/4] lg:min-h-[24rem] 2xl:min-h-[28rem]"
      aria-label="Hero image or video placeholder"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-card">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <circle cx="8.5" cy="10.5" r="1.5" fill="currentColor" stroke="none" />
            <path d="m21 16-5.5-5.5L5 19" />
          </svg>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden
          >
            <path d="M8 5v14l11-7L8 5z" />
          </svg>
        </div>
      </div>
      <p className="px-6 text-center text-sm font-medium">
        Image or video coming soon
      </p>
    </div>
  );
}

export default function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const { user } = useAuth();

  useGSAP(
    () => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.from(".hero-title", { y: 40, ...entrance, duration: 0.8 })
        .from(".hero-badge", { y: 16, ...entrance, duration: 0.5 }, "-=0.35")
        .from(".hero-sub", { y: 24, ...entrance, duration: 0.7 }, "-=0.25")
        .from(
          ".hero-cta-row > *",
          { y: 20, ...entrance, stagger: 0.08 },
          "-=0.35"
        )
        .from(
          ".hero-media",
          { y: 32, scale: 0.98, ...entrance, duration: 0.8 },
          "-=0.5"
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
      <div className="site-container">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-12 2xl:gap-16">
          <div className="min-w-0 max-w-3xl 2xl:max-w-none">
          <h1 className="hero-title text-5xl font-bold leading-[1.08] text-foreground md:text-6xl lg:text-7xl 2xl:text-8xl">
            <span className="block">New look,</span>
            <span className="block">new features,</span>
            <span className="block">
              same{" "}
              <span className="inline-flex items-center gap-2 text-hazard">
                <svg
                  className="h-[0.6em] w-[0.6em] shrink-0"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden
                >
                  <path
                    fillRule="evenodd"
                    d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5z"
                    clipRule="evenodd"
                  />
                </svg>
                BORG.
              </span>
            </span>
          </h1>
          <p className="hero-badge mb-0 mt-6 inline-flex items-center gap-2 rounded-full border border-hazard/25 bg-hazard/5 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.2em] text-muted">
            <svg
              className="h-4 w-4 shrink-0 text-hazard"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden
            >
              <path
                fillRule="evenodd"
                d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5z"
                clipRule="evenodd"
              />
            </svg>
            Black Out Rage Gallon
          </p>
          <p className="hero-sub mt-4 max-w-xl text-lg text-muted md:text-xl 2xl:max-w-2xl 2xl:text-2xl">
            Take your drinking to another level with a BORG!
          </p>
          <div className="hero-cta-row mt-10 flex max-w-full flex-wrap items-center gap-3 sm:gap-4">
            <Link
              to={user ? "/dashboard" : "/signup"}
              className="hero-btn hero-btn-text border-transparent bg-gradient-to-r from-cyan to-sky-400 font-semibold text-on-accent transition-opacity hover:opacity-90"
            >
              {user ? "Dashboard" : "Sign up"}
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

          <HeroMediaPlaceholder />
        </div>
      </div>
    </section>
  );
}
