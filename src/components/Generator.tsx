import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { generateBorgName, generateMioName } from "../lib/generateName";
import { recordLike } from "../lib/leaderboard";
import { addSavedLike, recordRoll } from "../lib/userData";
import { useAuth } from "../context/AuthContext";
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
  rollType,
  likable = false,
  compact = false,
}: {
  label: string;
  placeholder: string;
  accent: "cyan" | "magenta";
  onGenerate: () => string;
  rollType: "borg" | "mio";
  likable?: boolean;
  compact?: boolean;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLParagraphElement>(null);
  const reducedMotion = useReducedMotion();
  const { user } = useAuth();
  const [pendingName, setPendingName] = useState<string | null>(null);
  const [likedName, setLikedName] = useState<string | null>(null);
  const canLike = likable && Boolean(user);

  const accentClasses = compact
    ? accent === "cyan"
      ? "border-cyan/25 hover:border-cyan/50"
      : "border-magenta/25 hover:border-magenta/50"
    : accent === "cyan"
      ? "generator-card-cyan"
      : "generator-card-magenta";

  const cardSurfaceClasses = compact
    ? "dashboard-panel p-4"
    : "rounded-3xl border p-6 backdrop-blur-sm md:p-8";

  const buttonClasses =
    accent === "cyan"
      ? "from-cyan to-sky-400 text-on-accent"
      : "from-magenta to-fuchsia-400 text-on-accent";

  const runGenerate = () => {
    const name = onGenerate();
    recordRoll(rollType, name);
    if (!nameRef.current || !cardRef.current) return;

    setPendingName(null);
    setLikedName(null);
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

      if (likable) {
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

  const handleLike = () => {
    if (!canLike || !pendingName) return;
    recordLike(pendingName);
    addSavedLike(pendingName);
    setLikedName(pendingName);
    setPendingName(null);
  };

  const showActions = likable && pendingName;
  const showLiked = canLike && likedName && !pendingName;

  return (
    <div
      ref={cardRef}
      className={`flex flex-col transition-colors ${cardSurfaceClasses} ${accentClasses}`}
    >
      <p
        className={`text-xs font-semibold uppercase tracking-[0.25em] text-subtle ${
          compact ? "mb-2" : "mb-3"
        }`}
      >
        {label}
      </p>
      <div
        className={`flex gap-3 rounded-2xl border border-border bg-elevated px-4 ${
          compact
            ? "mb-4 min-h-[4.5rem] py-2"
            : "mb-6 min-h-[5.5rem] py-3"
        }`}
      >
        <div className="flex min-w-0 flex-1 items-center">
          <p
            ref={nameRef}
            className={`font-semibold leading-tight text-subtle ${
              compact ? "text-lg md:text-xl" : "text-xl md:text-2xl"
            }`}
          >
            {placeholder}
          </p>
        </div>
        {likable && (
          <div className="flex shrink-0 flex-row items-center justify-center gap-2 self-stretch">
            {showActions && (
              <>
                <button
                  type="button"
                  onClick={runGenerate}
                  aria-label="Re-roll"
                  className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-border bg-card text-muted transition-colors hover:border-cyan/40 hover:bg-hover hover:text-foreground"
                >
                  <svg
                    width="16"
                    height="16"
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
                </button>
                {canLike ? (
                  <button
                    type="button"
                    onClick={handleLike}
                    aria-label="Like this borg"
                    className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-cyan/30 bg-cyan/10 text-cyan transition-colors hover:bg-cyan/20"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden
                    >
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                    </svg>
                  </button>
                ) : null}
              </>
            )}
            {showLiked && (
              <span
                aria-label="Liked"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan/10 text-cyan"
              >
                <svg
                  width="16"
                  height="16"
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
              </span>
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={runGenerate}
        className={`cursor-pointer rounded-full bg-gradient-to-r px-6 text-sm font-semibold transition-transform hover:scale-[1.02] active:scale-[0.98] ${buttonClasses} ${
          compact ? "py-3" : "py-3.5"
        }`}
      >
        {likedName
          ? "Generate another"
          : `Generate your ${label.toLowerCase()}!`}
      </button>
    </div>
  );
}

export default function Generator({
  embedded = false,
  stacked = false,
  compact = false,
}: {
  embedded?: boolean;
  stacked?: boolean;
  compact?: boolean;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const { user } = useAuth();

  useGSAP(
    () => {
      if (embedded) return;
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
    <section
      id="generator"
      ref={sectionRef}
      className={embedded ? "" : "generator-section px-4 py-24 md:px-8"}
    >
      <div className={embedded ? "" : "site-container"}>
        {!embedded && (
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
            {!user && (
              <p className="mx-auto mt-3 max-w-lg text-sm text-muted">
                Sign in to like and save BORG names you love—they&apos;ll show up
                in your history.{" "}
                <Link
                  to="/login"
                  className="font-medium text-cyan transition-colors hover:underline"
                >
                  Log in
                </Link>
                {" or "}
                <Link
                  to="/signup"
                  className="font-medium text-cyan transition-colors hover:underline"
                >
                  sign up free
                </Link>
                .
              </p>
            )}
          </div>
        )}
        <div
          className={
            stacked
              ? "flex flex-col gap-6"
              : "grid gap-6 md:grid-cols-2"
          }
        >
          <div data-reveal>
            <GeneratorCard
              label="BORG"
              placeholder="Generate your borg!"
              accent="cyan"
              rollType="borg"
              onGenerate={generateBorgName}
              likable
              compact={compact}
            />
          </div>
          <div data-reveal>
            <GeneratorCard
              label="Mio"
              placeholder="Generate your Mio!"
              accent="magenta"
              rollType="mio"
              onGenerate={generateMioName}
              compact={compact}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
