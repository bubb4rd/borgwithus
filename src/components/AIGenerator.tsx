import { useEffect, useRef, useState, type ReactNode } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { recordAIFeedback, type AIFeedback } from "../lib/aiFeedback";
import {
  BorgAiError,
  generateAIName,
  getBorgAiUsage,
  type BorgAiUsage,
} from "../lib/generateAIName";
import { recordRoll } from "../lib/userData";
import { useAuth } from "../context/AuthContext";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { BorgingIndicator } from "./BorgingIndicator";
import {
  BorgAiStatusMessage,
  classifyBorgAiError,
} from "./BorgAiStatusMessage";

const inputClass =
  "w-full rounded-xl border border-border bg-input px-4 py-3 text-foreground outline-none transition-colors focus:border-magenta/50";

/** Shown in the generator UI only — not sent from the API. */
function getBorgAiGenerateErrorCode(message: string): string | null {
  if (/timed out/i.test(message)) return "3BWGT00";
  if (
    /returned an empty|returned nothing|empty borg name|invalid borg name format/i.test(
      message,
    )
  ) {
    return "3BWGT01";
  }
  if (/blocked|disliked|unique borg name/i.test(message)) {
    return "3BWGT44";
  }
  return null;
}

function FeedbackButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border transition-colors ${
        active
          ? "border-magenta/40 bg-magenta/15 text-magenta"
          : "border-border bg-elevated text-muted hover:border-magenta/30 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

export default function AIGenerator({ embedded = false }: { embedded?: boolean }) {
  const sectionRef = useRef<HTMLElement>(null);
  const resultRef = useRef<HTMLParagraphElement>(null);
  const reducedMotion = useReducedMotion();
  const { user } = useAuth();
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<AIFeedback | null>(null);
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<BorgAiUsage | null>(null);

  useEffect(() => {
    void getBorgAiUsage().then(setUsage);
  }, [user?.id]);

  const tracked = usage?.tracked ?? false;
  const limitReached = tracked && usage !== null && usage.remaining <= 0;
  const usageLabel =
    usage === null
      ? null
      : `${usage.remaining}/${usage.limit} left today`;

  useGSAP(
    () => {
      if (embedded) return;

      gsap.from(".ai-header > *", {
        y: 20,
        autoAlpha: 0,
        stagger: 0.08,
        duration: 0.6,
        ease: "power3.out",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 85%",
        },
      });
    },
    { scope: sectionRef }
  );

  const handleGenerate = async () => {
    if (limitReached) return;

    setStatus("loading");
    setResult(null);
    setFeedback(null);
    setError(null);

    try {
      const tone = user?.settings.aiTone ?? "funny";
      const generated = await generateAIName(prompt, tone);
      recordRoll("ai", generated.name);
      setResult(generated.name);
      setUsage(generated.usage);

      if (!resultRef.current || reducedMotion) return;
      gsap.fromTo(
        resultRef.current,
        { y: 8, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.45, ease: "power2.out" },
      );
    } catch (err) {
      const message =
        err instanceof BorgAiError
          ? err.message
          : "BORG AI could not generate a name. Try again.";
      setError(message);
      if (err instanceof BorgAiError && err.usage) {
        setUsage(err.usage);
      }
    } finally {
      setStatus("idle");
    }
  };

  const handleFeedback = (value: AIFeedback) => {
    if (!result) return;
    setFeedback(value);
    void recordAIFeedback(result, prompt, value);
  };

  const panelClass = embedded
    ? "dashboard-panel overflow-hidden border-magenta/20"
    : "glass rounded-3xl border border-magenta/25 p-6 glow-magenta md:p-8";

  if (embedded) {
    return (
      <section id="ai-generator" ref={sectionRef}>
        <div className={panelClass}>
          <div className="p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-magenta">
                BORG AI
              </p>
              <span className="rounded-full border border-hazard/25 bg-hazard/10 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-hazard">
                Beta
              </span>
              {usageLabel ? (
                <span className="w-full text-xs tabular-nums text-subtle sm:ml-auto sm:w-auto">
                  {usageLabel}
                </span>
              ) : null}
            </div>

            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (status !== "loading" && !limitReached) handleGenerate();
                    }
                  }}
                  rows={2}
                  placeholder="e.g. tropical pool party, chaotic finance bro, gym rat energy..."
                  aria-label="BORG AI context"
                  disabled={limitReached}
                  className={`${inputClass} w-full resize-none px-3 py-2.5 pr-14 text-sm disabled:cursor-not-allowed disabled:opacity-60`}
                />
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={status === "loading" || limitReached}
                  aria-label={result ? "Re-generate name" : "Generate name"}
                  className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg bg-cyan text-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {status === "loading" ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/30 border-t-ink" />
                  ) : (
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M12 19V5" />
                      <path d="m5 12 7-7 7 7" />
                    </svg>
                  )}
                </button>
              </div>

              <div
                className={`flex min-h-[3.25rem] w-full min-w-[12rem] items-center justify-between gap-3 rounded-xl border bg-elevated px-3 py-2.5 sm:w-1/2 sm:flex-none ${
                  error && !result
                    ? classifyBorgAiError(error) === "limit"
                      ? "border-muted/50 bg-muted/5"
                      : "border-red-500/30 bg-red-500/5"
                    : limitReached && !result && !error
                      ? "border-muted/50 bg-muted/5"
                    : status === "loading"
                      ? "border-muted/50"
                      : "border-border"
                }`}
                aria-live="polite"
              >
                {result ? (
                  <>
                    <p
                      ref={resultRef}
                      className="min-w-0 flex-1 truncate text-lg font-semibold text-foreground"
                    >
                      {result}
                    </p>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <FeedbackButton
                        label="Like this name"
                        active={feedback === "like"}
                        onClick={() => handleFeedback("like")}
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
                          <path d="M7 10v12" />
                          <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a1 1 0 0 1-1-1v-7a4 4 0 0 1 4-4h2.5" />
                        </svg>
                      </FeedbackButton>
                      <FeedbackButton
                        label="Dislike this name"
                        active={feedback === "dislike"}
                        onClick={() => handleFeedback("dislike")}
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
                          <path d="M17 14V2" />
                          <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a1 1 0 0 1 1 1v7a4 4 0 0 1-4 4h-2.5" />
                        </svg>
                      </FeedbackButton>
                    </div>
                  </>
                ) : error ? (
                  <BorgAiStatusMessage
                    kind={classifyBorgAiError(error)}
                    code={getBorgAiGenerateErrorCode(error) ?? undefined}
                  >
                    {error}
                  </BorgAiStatusMessage>
                ) : status === "loading" ? (
                  <BorgingIndicator />
                ) : limitReached ? (
                  <BorgAiStatusMessage kind="limit">
                    Daily limit reached. Try again tomorrow.
                  </BorgAiStatusMessage>
                ) : (
                  <BorgAiStatusMessage kind="idle">
                    Generated name appears here.
                  </BorgAiStatusMessage>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      id="ai-generator"
      ref={sectionRef}
      className="px-4 py-16 md:px-8"
    >
      <div className="site-container">
        <div className="ai-header mb-8">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-magenta">
            BORG AI
          </p>
          <h2 className="text-3xl font-bold text-foreground md:text-4xl">
            Custom BORG names
          </h2>
          <p className="mt-2 max-w-xl text-subtle">
            Describe a vibe, theme, or inside joke and the nano model will craft a
            fresh BORG name.
            {usageLabel ? ` ${usageLabel}.` : null}
          </p>
        </div>

        <div className={panelClass}>
          {error ? (
            <div
              className={`mb-3 rounded-lg border px-3 py-2 ${
                classifyBorgAiError(error) === "limit"
                  ? "border-muted/50 bg-muted/5"
                  : "border-red-500/30 bg-red-500/10"
              }`}
            >
              <BorgAiStatusMessage kind={classifyBorgAiError(error)}>
                {error}
              </BorgAiStatusMessage>
            </div>
          ) : limitReached ? (
            <div className="mb-3 rounded-lg border border-muted/50 bg-muted/5 px-3 py-2">
              <BorgAiStatusMessage kind="limit">
                Daily limit reached. Try again tomorrow.
              </BorgAiStatusMessage>
            </div>
          ) : null}
          <label className="block">
            <span className="mb-2 block text-sm text-subtle">Context</span>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              placeholder="e.g. tropical pool party, chaotic finance bro..."
              disabled={limitReached}
              className={`${inputClass} resize-none disabled:cursor-not-allowed disabled:opacity-60`}
            />
          </label>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={status === "loading" || limitReached}
            className="mt-4 cursor-pointer rounded-full bg-cyan px-6 py-3 text-sm font-semibold text-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status === "loading" ? (
              <BorgingIndicator compact showStatus={false} />
            ) : limitReached ? (
              "Daily limit reached"
            ) : (
              "Generate"
            )}
          </button>
        </div>
      </div>
    </section>
  );
}
