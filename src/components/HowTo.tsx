import { useCallback, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useReducedMotion } from "../hooks/useReducedMotion";

const steps = [
  {
    id: 1,
    title: "Fill the jar",
    subtitle: "Fill a gallon plastic jar halfway.",
  },
  {
    id: 2,
    title: "Add vodka",
    subtitle:
      "Pour in a small handle (750 mL) of a vodka of your choice.",
  },
  {
    id: 3,
    title: "Add Mio",
    subtitle: "Pour in 2 packets of Mio (1.62 oz each)",
  },
];

function VideoPlaceholder({ stepId }: { stepId: number }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-elevated text-subtle">
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-card shadow-sm">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden
        >
          <path d="M8 5v14l11-7L8 5z" />
        </svg>
      </div>
      <span className="px-4 text-center text-sm font-medium">
        Step {stepId} video coming soon
      </span>
    </div>
  );
}

function NavArrow({
  direction,
  onClick,
  emphasize = false,
}: {
  direction: "prev" | "next";
  onClick: () => void;
  emphasize?: boolean;
}) {
  const label = direction === "prev" ? "Previous step" : "Next step";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:border-cyan/40 hover:bg-hover ${
        emphasize ? "next-hint" : ""
      }`}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {direction === "prev" ? (
          <path d="M15 18l-6-6 6-6" />
        ) : (
          <path d="M9 18l6-6-6-6" />
        )}
      </svg>
    </button>
  );
}

export default function HowTo() {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeStep = steps[activeIndex];
  const reducedMotion = useReducedMotion();

  const sectionRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  const showNextHint = activeIndex < 2 && !reducedMotion;

  useGSAP(
    () => {
      if (!videoRef.current || !textRef.current || reducedMotion) return;

      gsap.fromTo(
        [videoRef.current, textRef.current],
        { autoAlpha: 0, x: 14 },
        {
          autoAlpha: 1,
          x: 0,
          duration: 0.5,
          ease: "power2.out",
          stagger: 0.07,
        }
      );
    },
    { scope: sectionRef, dependencies: [activeIndex], revertOnUpdate: true }
  );

  const goPrev = useCallback(() => {
    setActiveIndex((i) => (i === 0 ? steps.length - 1 : i - 1));
  }, []);

  const goNext = useCallback(() => {
    setActiveIndex((i) => (i === steps.length - 1 ? 0 : i + 1));
  }, []);

  return (
    <section id="how-to" className="px-4 py-24 md:px-8">
      <div className="mx-auto max-w-6xl">
        <div data-reveal className="mb-12 max-w-2xl">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-cyan">
            Recipe
          </p>
          <h2 className="text-4xl font-bold text-foreground md:text-5xl">
            How to borg
          </h2>
        </div>

        <div
          ref={sectionRef}
          data-reveal
          className="glass flex h-[55vh] min-h-[352px] flex-col overflow-hidden rounded-3xl sm:flex-row"
        >
          <div className="min-h-0 shrink-0 p-4 sm:h-full sm:w-[62%] sm:p-5 md:w-[65%]">
            <div ref={videoRef} className="h-full w-full min-h-[180px]">
              <VideoPlaceholder stepId={activeStep.id} />
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col justify-end p-4 sm:p-5 md:p-6">
            <div className="flex items-end justify-between gap-4">
              <div
                ref={textRef}
                className="min-w-0 flex-1"
                aria-live="polite"
                aria-atomic="true"
              >
                <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan">
                  Step {activeStep.id} of {steps.length}
                </p>
                <h3 className="text-lg font-semibold text-foreground sm:text-xl md:text-2xl">
                  {activeStep.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted sm:text-base">
                  {activeStep.subtitle}
                </p>
              </div>

              <div className="flex shrink-0 gap-2">
                <NavArrow direction="prev" onClick={goPrev} />
                <NavArrow
                  direction="next"
                  onClick={goNext}
                  emphasize={showNextHint}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
