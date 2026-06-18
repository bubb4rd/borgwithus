import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getTopEntries,
  type LeaderboardEntry,
  type LeaderboardMetric,
} from "../lib/leaderboard";

const VISIBLE_COUNT = 4;
const FETCH_COUNT = VISIBLE_COUNT + 1;

function HeartIcon({ className }: { className?: string }) {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  );
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function MetricToggle({
  metric,
  onChange,
}: {
  metric: LeaderboardMetric;
  onChange: (metric: LeaderboardMetric) => void;
}) {
  return (
    <div
      className="relative grid shrink-0 grid-cols-2 rounded-full border border-border bg-elevated p-0.5"
      role="group"
      aria-label="Leaderboard metric"
    >
      <span
        className={`pointer-events-none absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-full bg-card shadow-sm transition-transform duration-200 ${
          metric === "rating" ? "translate-x-full" : "translate-x-0"
        }`}
        aria-hidden
      />
      <button
        type="button"
        onClick={() => onChange("likes")}
        aria-label="Likes"
        aria-pressed={metric === "likes"}
        className={`relative z-10 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full transition-colors ${
          metric === "likes" ? "text-magenta" : "text-subtle hover:text-muted"
        }`}
      >
        <HeartIcon />
      </button>
      <button
        type="button"
        onClick={() => onChange("rating")}
        aria-label="Ratings"
        aria-pressed={metric === "rating"}
        className={`relative z-10 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full transition-colors ${
          metric === "rating" ? "text-hazard" : "text-subtle hover:text-muted"
        }`}
      >
        <StarIcon />
      </button>
    </div>
  );
}

function formatEntryValue(metric: LeaderboardMetric, entry: LeaderboardEntry) {
  if (metric === "rating") {
    return (
      <>
        <span className="font-medium text-foreground">{entry.value.toFixed(1)}</span>
        <span className="text-hazard"> ★</span>
      </>
    );
  }

  return entry.value.toLocaleString();
}

function EntryRow({
  entry,
  rank,
  metric,
}: {
  entry: LeaderboardEntry;
  rank: number;
  metric: LeaderboardMetric;
}) {
  const isFirst = rank === 1;

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border bg-background/40 ${
        isFirst
          ? "highlight-entry px-3.5 py-2.5"
          : "border-border/50 px-3 py-2"
      }`}
    >
      <span
        className={`w-5 shrink-0 text-center font-bold ${
          isFirst ? "text-base text-hazard" : "text-sm text-subtle"
        }`}
      >
        {rank}
      </span>
      <span
        className={`min-w-0 flex-1 truncate font-medium text-foreground ${
          isFirst ? "text-base" : "text-sm"
        }`}
      >
        {entry.name}
      </span>
      <span
        className={`shrink-0 tabular-nums text-muted ${
          isFirst ? "text-sm" : "text-xs"
        }`}
      >
        {formatEntryValue(metric, entry)}
      </span>
    </div>
  );
}

export default function LeaderboardCallout() {
  const [metric, setMetric] = useState<LeaderboardMetric>("likes");
  const [entries, setEntries] = useState<LeaderboardEntry[]>(() =>
    getTopEntries("likes", FETCH_COUNT)
  );

  useEffect(() => {
    const refresh = () => setEntries(getTopEntries(metric, FETCH_COUNT));
    refresh();
    window.addEventListener("leaderboard:update", refresh);
    return () => window.removeEventListener("leaderboard:update", refresh);
  }, [metric]);

  const visibleEntries = entries.slice(0, VISIBLE_COUNT);
  const teaserEntry = entries[VISIBLE_COUNT];
  const title = metric === "likes" ? "Top likes" : "Top rated";

  return (
    <section className="dashboard-panel flex h-full flex-col p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-hazard">
            Leaderboard
          </p>
          <h2 className="mt-1 text-xl font-bold text-foreground">{title}</h2>
        </div>
        <MetricToggle metric={metric} onChange={setMetric} />
      </div>

      {entries.length === 0 ? (
        <p className="flex-1 text-sm text-subtle">
          {metric === "likes"
            ? "No likes on the board yet."
            : "No ratings on the board yet."}
        </p>
      ) : (
        <div className="relative min-h-0 flex-1">
          <ol className="space-y-2">
            {visibleEntries.map((entry, i) => (
              <li key={`${metric}-${entry.name}`}>
                <EntryRow entry={entry} rank={i + 1} metric={metric} />
              </li>
            ))}
            {teaserEntry && (
              <li
                className="pointer-events-none select-none overflow-hidden [mask-image:linear-gradient(to_bottom,black_0%,black_32%,transparent_68%)] [-webkit-mask-image:linear-gradient(to_bottom,black_0%,black_32%,transparent_68%)]"
                aria-hidden
              >
                <EntryRow
                  entry={teaserEntry}
                  rank={VISIBLE_COUNT + 1}
                  metric={metric}
                />
              </li>
            )}
          </ol>
        </div>
      )}

      <Link
        to="/dashboard/leaderboard"
        className="mt-auto pt-4 text-center text-sm font-medium text-cyan transition-colors hover:underline"
      >
        View full leaderboard →
      </Link>
    </section>
  );
}
