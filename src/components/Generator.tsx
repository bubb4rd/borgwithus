import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { generateBorgName, generateMioName } from "../lib/generateName";
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
}: {
  label: string;
  placeholder: string;
  accent: "cyan" | "magenta";
  onGenerate: () => string;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLParagraphElement>(null);
  const reducedMotion = useReducedMotion();

  const accentClasses =
    accent === "cyan"
      ? "border-cyan/25 glow-cyan hover:border-cyan/50"
      : "border-magenta/25 glow-magenta hover:border-magenta/50";

  const buttonClasses =
    accent === "cyan"
      ? "from-cyan to-sky-400 text-on-accent"
      : "from-magenta to-fuchsia-400 text-on-accent";

  const handleGenerate = () => {
    const name = onGenerate();
    if (!nameRef.current || !cardRef.current) return;

    if (!reducedMotion) {
      gsap.fromTo(
        cardRef.current,
        { scale: 0.985 },
        { scale: 1, duration: 0.35, ease: "back.out(2)" }
      );
    }

    scrambleTo(nameRef.current, name, reducedMotion, () => {
      if (!nameRef.current || reducedMotion) return;
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

  return (
    <div
      ref={cardRef}
      className={`glass flex flex-col rounded-3xl border p-6 transition-colors md:p-8 ${accentClasses}`}
    >
      <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-subtle">
        {label}
      </p>
      <div className="mb-8 min-h-[5rem] rounded-2xl border border-border bg-elevated px-5 py-6">
        <p
          ref={nameRef}
          className="text-2xl font-semibold leading-tight text-subtle md:text-3xl"
        >
          {placeholder}
        </p>
      </div>
      <button
        type="button"
        onClick={handleGenerate}
        className={`cursor-pointer rounded-full bg-gradient-to-r px-6 py-3.5 text-sm font-semibold transition-transform hover:scale-[1.02] active:scale-[0.98] ${buttonClasses}`}
      >
        Generate your {label.toLowerCase()}!
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
