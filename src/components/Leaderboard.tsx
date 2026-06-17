import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import {
  getTopEntries,
  METRIC_LABELS,
  type LeaderboardEntry,
  type LeaderboardMetric,
} from "../lib/leaderboard";

const PODIUM_ORDER = [1, 0, 2] as const;
const METRICS: LeaderboardMetric[] = ["picks", "rating"];

const rankStyles = {
  1: {
    block: "h-44 sm:h-52 border-cyan/30 bg-gradient-to-t from-cyan/20 to-cyan/5 glow-cyan",
    medal: "bg-gradient-to-br from-cyan to-sky-400 text-on-accent",
    label: "1st",
  },
  2: {
    block: "h-32 sm:h-40 border-border bg-elevated",
    medal: "border border-border bg-card text-muted",
    label: "2nd",
  },
  3: {
    block: "h-24 sm:h-32 border-hazard/25 bg-gradient-to-t from-hazard/15 to-transparent",
    medal: "bg-gradient-to-br from-hazard to-orange-400 text-on-accent",
    label: "3rd",
  },
} as const;

function formatValue(metric: LeaderboardMetric, entry: LeaderboardEntry) {
  if (metric === "rating") {
    return (
      <>
        <span className="font-semibold text-cyan">{entry.value.toFixed(1)}</span>
        <span className="text-hazard"> ★</span>
      </>
    );
  }

  return (
    <>
      <span className="font-semibold text-cyan">
        {entry.value.toLocaleString()}
      </span>{" "}
      picks
    </>
  );
}

function PodiumSpot({
  entry,
  rank,
  metric,
}: {
  entry: LeaderboardEntry | undefined;
  rank: 1 | 2 | 3;
  metric: LeaderboardMetric;
}) {
  const style = rankStyles[rank];

  return (
    <div className="flex w-full max-w-[11rem] flex-col items-center sm:max-w-[13rem]">
      <div className="mb-4 flex min-h-[6rem] flex-col items-center justify-end text-center">
        <span
          className={`mb-3 flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold ${style.medal}`}
        >
          {style.label}
        </span>
        <p className="line-clamp-2 text-base font-semibold leading-snug text-foreground sm:text-lg">
          {entry?.name ?? "—"}
        </p>
        <p className="mt-1 text-sm text-subtle">
          {entry ? formatValue(metric, entry) : "No data yet"}
        </p>
        {entry?.detail && (
          <p className="mt-0.5 text-xs text-subtle">{entry.detail}</p>
        )}
      </div>
      <div
        className={`flex w-full items-end justify-center rounded-t-2xl border px-3 pb-4 pt-6 ${style.block}`}
      >
        <span className="text-3xl font-bold text-foreground/20 sm:text-4xl">
          {rank}
        </span>
      </div>
    </div>
  );
}

export default function Leaderboard() {
  const [metric, setMetric] = useState<LeaderboardMetric>("picks");
  const [entries, setEntries] = useState(() => getTopEntries("picks"));
  const sectionRef = useRef<HTMLElement>(null);
  const podiumRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setEntries(getTopEntries(metric));
  }, [metric]);

  useEffect(() => {
    const refresh = () => setEntries(getTopEntries(metric));
    window.addEventListener("leaderboard:update", refresh);
    return () => window.removeEventListener("leaderboard:update", refresh);
  }, [metric]);

  useGSAP(
    () => {
      gsap.from(".podium-spot", {
        y: 40,
        autoAlpha: 0,
        stagger: 0.12,
        duration: 0.8,
        ease: "power3.out",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 80%",
        },
      });
    },
    { scope: sectionRef }
  );

  useGSAP(
    () => {
      if (!podiumRef.current) return;
      gsap.fromTo(
        podiumRef.current.querySelectorAll(".podium-spot"),
        { y: 12, autoAlpha: 0.6 },
        {
          y: 0,
          autoAlpha: 1,
          stagger: 0.06,
          duration: 0.35,
          ease: "power2.out",
        }
      );
    },
    { scope: podiumRef, dependencies: [metric, entries] }
  );

  const ordered = PODIUM_ORDER.map((i) => entries[i]);
  const { description } = METRIC_LABELS[metric];

  return (
    <section id="leaderboard" ref={sectionRef} className="px-4 py-24 md:px-8">
      <div className="mx-auto max-w-6xl">
        <div data-reveal className="mb-12 text-center">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-magenta">
            Community favorites
          </p>
          <h2 className="text-4xl font-bold text-foreground md:text-5xl">
            Borg Hall of Fame
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-subtle">{description}</p>
        </div>

        <div
          data-reveal
          className="glass mx-auto max-w-3xl rounded-3xl border border-border p-6 sm:p-10"
        >
          <div className="mb-8 grid grid-cols-2 gap-1 rounded-full border border-border bg-elevated p-1">
            {METRICS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMetric(m)}
                className={`cursor-pointer rounded-full py-2.5 text-xs font-semibold transition-colors sm:text-sm ${
                  metric === m
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {METRIC_LABELS[m].label}
              </button>
            ))}
          </div>

          {metric === "rating" && (
            <p className="mb-6 text-center text-xs text-subtle sm:text-sm">
              Ratings are submitted by signed-up members.{" "}
              <Link
                to="/signup"
                className="text-cyan transition-colors hover:underline"
              >
                Sign up
              </Link>{" "}
              to rate names.
            </p>
          )}

          <div
            ref={podiumRef}
            className="flex items-end justify-center gap-3 sm:gap-6"
          >
            {ordered.map((entry, i) => {
              const rank = (PODIUM_ORDER[i] + 1) as 1 | 2 | 3;
              return (
                <div key={`${metric}-${rank}`} className="podium-spot flex-1">
                  <PodiumSpot entry={entry} rank={rank} metric={metric} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
