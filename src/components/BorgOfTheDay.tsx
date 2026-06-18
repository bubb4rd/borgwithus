import { useCallback, useEffect, useState } from "react";
import {
  getBorgOfTheDayStats,
  pickBorgOfTheDay,
  rateBorgOfTheDay,
} from "../lib/borgOfTheDay";
import StarRating from "./StarRating";

export default function BorgOfTheDay() {
  const [stats, setStats] = useState(getBorgOfTheDayStats);

  const refresh = useCallback(() => setStats(getBorgOfTheDayStats()), []);

  useEffect(() => {
    window.addEventListener("leaderboard:update", refresh);
    window.addEventListener("user-data:update", refresh);
    return () => {
      window.removeEventListener("leaderboard:update", refresh);
      window.removeEventListener("user-data:update", refresh);
    };
  }, [refresh]);

  const handlePick = () => {
    if (stats.picked) return;
    pickBorgOfTheDay();
    refresh();
  };

  const handleRate = (stars: number) => {
    if (stats.rated) return;
    rateBorgOfTheDay(stars);
    refresh();
  };

  return (
    <section className="dashboard-panel p-3.5 sm:p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-hazard">
        BORG of the day
      </p>
      <h2 className="mt-0.5 truncate text-lg font-bold text-foreground">
        {stats.name}
      </h2>
      <p className="mt-1.5 text-sm text-muted">
        Pick and rate today&apos;s featured name on the leaderboard.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-4">
        {stats.picked ? (
          <span
            aria-label="Picked"
            className="inline-flex h-10 items-center gap-2 rounded-full border border-cyan/30 bg-cyan/10 px-4 text-base font-semibold text-cyan"
          >
            <svg
              width={18}
              height={18}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
            Picked
          </span>
        ) : (
          <button
            type="button"
            onClick={handlePick}
            aria-label="Pick this borg"
            className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border border-cyan/30 bg-cyan/10 px-4 text-base font-semibold text-cyan transition-colors hover:bg-cyan/20"
          >
            <svg
              width={18}
              height={18}
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden
            >
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
            Pick
          </button>
        )}

        <StarRating
          size="lg"
          value={stats.rating}
          onChange={stats.rated ? undefined : handleRate}
        />
      </div>

      <p className="mt-3 text-sm tabular-nums text-subtle">
        {stats.pickCount.toLocaleString()} community picks
      </p>
    </section>
  );
}
