import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useAuth } from "../context/AuthContext";
import ScrollHintList from "./ScrollHintList";
import {
  getTopEntries,
  getTopEntriesAsync,
  METRIC_LABELS,
  type LeaderboardEntry,
  type LeaderboardMetric,
} from "../lib/leaderboard";

const PODIUM_ORDER = [1, 0, 2] as const;
const METRICS: LeaderboardMetric[] = ["likes", "rating"];
const RUNNERS_COUNT = 22;
const LEADERBOARD_TOTAL = 3 + RUNNERS_COUNT;
const RUNNERS_LIST_HEIGHT = 340;

function getRankStyles(embedded: boolean) {
  return {
    1: {
      block: embedded
        ? "h-36 sm:h-40 border-cyan/30 bg-gradient-to-t from-cyan/20 to-cyan/5"
        : "h-44 sm:h-52 border-cyan/30 bg-gradient-to-t from-cyan/20 to-cyan/5 glow-cyan",
      medal: "bg-gradient-to-br from-cyan to-sky-400 text-on-accent",
      label: "1st",
    },
    2: {
      block: embedded
        ? "h-28 sm:h-32 border-foreground/20 bg-gradient-to-t from-foreground/12 to-elevated"
        : "h-32 sm:h-40 border-foreground/20 bg-gradient-to-t from-foreground/12 to-elevated",
      medal:
        "border border-foreground/25 bg-gradient-to-br from-foreground/20 to-foreground/5 text-foreground",
      label: "2nd",
    },
    3: {
      block: embedded
        ? "h-20 sm:h-24 border-hazard/25 bg-gradient-to-t from-hazard/15 to-transparent"
        : "h-24 sm:h-32 border-hazard/25 bg-gradient-to-t from-hazard/15 to-transparent",
      medal: "bg-gradient-to-br from-hazard to-orange-400 text-on-accent",
      label: "3rd",
    },
  } as const;
}

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
      likes
    </>
  );
}

function RunnersList({
  entries,
  metric,
  startRank,
}: {
  entries: LeaderboardEntry[];
  metric: LeaderboardMetric;
  startRank: number;
}) {
  if (entries.length === 0) return null;

  return (
    <ol className="space-y-2">
      {entries.map((entry, i) => (
        <li
          key={entry.name}
          className="flex items-center gap-3 rounded-xl border border-border bg-elevated px-3 py-2.5"
        >
          <span className="w-6 shrink-0 text-sm font-bold text-subtle">
            {startRank + i}
          </span>
          <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
            {entry.name}
          </p>
          <span className="shrink-0 text-sm text-subtle">
            {formatValue(metric, entry)}
          </span>
        </li>
      ))}
    </ol>
  );
}

function RunnersScrollPanel({
  entries,
  metric,
}: {
  entries: LeaderboardEntry[];
  metric: LeaderboardMetric;
}) {
  return (
    <ScrollHintList
      className="lg:w-72 lg:shrink-0"
      showHint={entries.length > 0}
      height={RUNNERS_LIST_HEIGHT}
      refreshDeps={[entries, metric]}
    >
      <RunnersList entries={entries} metric={metric} startRank={4} />
    </ScrollHintList>
  );
}

function PodiumSpot({
  entry,
  rank,
  metric,
  embedded = false,
}: {
  entry: LeaderboardEntry | undefined;
  rank: 1 | 2 | 3;
  metric: LeaderboardMetric;
  embedded?: boolean;
}) {
  const style = getRankStyles(embedded)[rank];

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

export default function Leaderboard({
  embedded = false,
  hideHeader = false,
}: {
  embedded?: boolean;
  hideHeader?: boolean;
}) {
  const { user } = useAuth();
  const [metric, setMetric] = useState<LeaderboardMetric>("likes");
  const [entries, setEntries] = useState(() => getTopEntries("likes", LEADERBOARD_TOTAL));
  const sectionRef = useRef<HTMLElement>(null);
  const podiumRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const next = await getTopEntriesAsync(metric, LEADERBOARD_TOTAL);
      if (active) setEntries(next);
    };

    void load();
    const refresh = () => void load();
    window.addEventListener("leaderboard:update", refresh);
    return () => {
      active = false;
      window.removeEventListener("leaderboard:update", refresh);
    };
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
        { y: 12, autoAlpha: 0.85 },
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

  const podiumEntries = PODIUM_ORDER.map((i) => entries[i]);
  const runnersUp = entries.slice(3, LEADERBOARD_TOTAL);

  return (
    <section
      id="leaderboard"
      ref={sectionRef}
      className={embedded ? "" : "px-4 py-24 md:px-8"}
    >
      <div className={embedded ? "" : "site-container"}>
        {!hideHeader && (
        <div
          data-reveal
          className={`${embedded ? "mb-5 text-left" : "mb-12 text-center"}`}
        >
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-magenta">
            Community favorites
          </p>
          <h2
            className={`font-bold text-foreground ${
              embedded ? "text-2xl" : "text-4xl md:text-5xl"
            }`}
          >
            Borg Hall of Fame
          </h2>
        </div>
        )}

        <div
          data-reveal
          className={
            embedded
              ? "dashboard-panel p-5 sm:p-8"
              : "glass mx-auto max-w-5xl rounded-3xl border border-border p-6 sm:p-10"
          }
        >
          <div className={`grid grid-cols-2 gap-1 rounded-full border border-border bg-elevated p-1 ${embedded ? "mb-5" : "mb-8"}`}>
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

          {metric === "rating" && !user && (
            <p className={`text-xs text-subtle sm:text-sm ${embedded ? "mb-4" : "mb-6 text-center"}`}>
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

          {entries.length === 0 ? (
            <p className={`text-sm text-subtle ${embedded ? "" : "text-center"}`}>
              {metric === "likes"
                ? "No likes yet. Like names from the generator to start the board."
                : "No ratings yet. Sign up and rate your favorite borgs."}
            </p>
          ) : (
          <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch lg:gap-8">
            <div
              ref={podiumRef}
              className="flex min-w-0 flex-1 items-end justify-center gap-3 sm:gap-6"
            >
              {podiumEntries.map((entry, i) => {
                const rank = (PODIUM_ORDER[i] + 1) as 1 | 2 | 3;
                return (
                  <div key={`${metric}-${rank}`} className="podium-spot flex-1">
                    <PodiumSpot
                      entry={entry}
                      rank={rank}
                      metric={metric}
                      embedded={embedded}
                    />
                  </div>
                );
              })}
            </div>

            {runnersUp.length > 0 && (
              <RunnersScrollPanel entries={runnersUp} metric={metric} />
            )}
          </div>
          )}
        </div>
      </div>
    </section>
  );
}
