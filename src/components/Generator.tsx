import { useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { generateBorgName, generateMioName } from "../lib/generateName";
import { recordPick } from "../lib/leaderboard";
import { useReducedMotion } from "../hooks/useReducedMotion";

const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!";

function scrambleTo(
  el: HTMLElement,
  finalText: string,
  reducedMotion: boolean,
  onComplete?: () => void
) {
  if (reducedMotion) {
    el.textContent = finalText;
    onComplete?.();
    return;
  }

  const proxy = { progress: 0 };
  gsap.to(proxy, {
    progress: 1,
    duration: 0.55,
    ease: "power2.out",
    onUpdate: () => {
      const p = proxy.progress;
      const revealed = Math.floor(p * finalText.length);
      let out = "";
      for (let i = 0; i < finalText.length; i++) {
        out +=
          i < revealed
            ? finalText[i]
            : CHARSET[Math.floor(Math.random() * CHARSET.length)];
      }
      el.textContent = out;
    },
    onComplete: () => {
      el.textContent = finalText;
      el.classList.remove("text-subtle");
      el.classList.add("text-foreground");
      onComplete?.();
    },
  });
}

function GeneratorCard({
  label,
  placeholder,
  accent,
  onGenerate,
  pickable = false,
}: {
  label: string;
  placeholder: string;
  accent: "cyan" | "magenta";
  onGenerate: () => string;
  pickable?: boolean;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLParagraphElement>(null);
  const reducedMotion = useReducedMotion();
  const [pendingName, setPendingName] = useState<string | null>(null);
  const [pickedName, setPickedName] = useState<string | null>(null);

  const accentClasses =
    accent === "cyan"
      ? "border-cyan/25 glow-cyan hover:border-cyan/50"
      : "border-magenta/25 glow-magenta hover:border-magenta/50";

  const buttonClasses =
    accent === "cyan"
      ? "from-cyan to-sky-400 text-on-accent"
      : "from-magenta to-fuchsia-400 text-on-accent";

  const runGenerate = () => {
    const name = onGenerate();
    if (!nameRef.current || !cardRef.current) return;

    setPendingName(null);
    setPickedName(null);
    nameRef.current.classList.remove("text-foreground");
    nameRef.current.classList.add("text-subtle");

    if (!reducedMotion) {
      gsap.fromTo(
        cardRef.current,
        { scale: 0.985 },
        { scale: 1, duration: 0.35, ease: "back.out(2)" }
      );
    }

    scrambleTo(nameRef.current, name, reducedMotion, () => {
      if (!nameRef.current) return;

      if (pickable) {
        setPendingName(name);
      }

      if (reducedMotion) return;
      gsap.fromTo(
        nameRef.current,
        { textShadow: "0 0 0px transparent" },
        {
          textShadow:
            accent === "cyan"
              ? "0 0 24px rgba(34,211,238,0.35)"
              : "0 0 24px rgba(232,121,249,0.35)",
          duration: 0.4,
          yoyo: true,
          repeat: 1,
        }
      );
    });
  };

  const handlePick = () => {
    if (!pendingName) return;
    recordPick(pendingName);
    setPickedName(pendingName);
    setPendingName(null);
  };

  const showActions = pickable && pendingName;
  const showPicked = pickable && pickedName && !pendingName;

  return (
    <div
      ref={cardRef}
      className={`glass flex flex-col rounded-3xl border p-6 transition-colors md:p-8 ${accentClasses}`}
    >
      <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-subtle">
        {label}
      </p>
      <div className="mb-8 flex min-h-[8.5rem] flex-col rounded-2xl border border-border bg-elevated px-5 py-4">
        <div className="flex flex-1 items-center">
          <p
            ref={nameRef}
            className="text-2xl font-semibold leading-tight text-subtle md:text-3xl"
          >
            {placeholder}
          </p>
        </div>
        <div className="flex h-9 items-center justify-end gap-2">
          {showActions && (
            <>
              <button
                type="button"
                onClick={handlePick}
                aria-label="Pick this borg"
                className="flex cursor-pointer items-center gap-1.5 rounded-full border border-cyan/30 bg-cyan/10 px-3 py-1.5 text-xs font-semibold text-cyan transition-colors hover:bg-cyan/20"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden
                >
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
                Pick
              </button>
              <button
                type="button"
                onClick={runGenerate}
                aria-label="Re-roll"
                className="flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:border-cyan/40 hover:bg-hover hover:text-foreground"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M21 12a9 9 0 1 1-3-6.7" />
                  <path d="M21 3v6h-6" />
                </svg>
                Re-roll
              </button>
            </>
          )}
          {showPicked && (
            <span className="inline-flex items-center gap-1 rounded-full bg-cyan/10 px-3 py-1.5 text-xs font-semibold text-cyan">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
              Picked
            </span>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={runGenerate}
        className={`cursor-pointer rounded-full bg-gradient-to-r px-6 py-3.5 text-sm font-semibold transition-transform hover:scale-[1.02] active:scale-[0.98] ${buttonClasses}`}
      >
        {pickedName
          ? "Generate another"
          : `Generate your ${label.toLowerCase()}!`}
      </button>
    </div>
  );
}

export default function Generator() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      gsap.from(".gen-header > *", {
        y: 24,
        autoAlpha: 0,
        stagger: 0.08,
        duration: 0.7,
        ease: "power3.out",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 80%",
        },
      });
    },
    { scope: sectionRef }
  );

  return (
    <section id="generator" ref={sectionRef} className="px-4 py-24 md:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="gen-header mb-12 text-center">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-lime">
            Name generator
          </p>
          <h2 className="text-4xl font-bold text-foreground md:text-5xl">
            Let&apos;s borg.
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-subtle">
            Please drink responsibly.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <div data-reveal>
            <GeneratorCard
              label="BORG"
              placeholder="Generate your borg!"
              accent="cyan"
              onGenerate={generateBorgName}
              pickable
            />
          </div>
          <div data-reveal>
            <GeneratorCard
              label="MIO"
              placeholder="Generate your mio!"
              accent="magenta"
              onGenerate={generateMioName}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
