import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getTopEntries, type LeaderboardEntry } from "../lib/leaderboard";

const ICONS = ["🍺", "🎲", "⭐", "🔥", "🧪"] as const;

export default function DashboardTopBorgsList() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    const refresh = () => setEntries(getTopEntries("likes", 5));
    refresh();
    window.addEventListener("leaderboard:update", refresh);
    return () => window.removeEventListener("leaderboard:update", refresh);
  }, []);

  return (
    <section className="dashboard-panel p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-[var(--dash-foreground)]">
          Top borgs
        </h2>
        <Link
          to="/dashboard/leaderboard"
          className="text-sm font-medium text-cyan hover:underline"
        >
          + New
        </Link>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-[var(--dash-muted)]">
          No community likes yet. Be the first to like a name.
        </p>
      ) : (
        <ul className="space-y-3">
          {entries.map((entry, i) => (
            <li
              key={entry.name}
              className="flex items-center gap-3 rounded-2xl border border-[var(--dash-border)] bg-[var(--dash-green-soft)]/35 px-3 py-2.5"
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--dash-surface)] text-base"
                aria-hidden
              >
                {ICONS[i % ICONS.length]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[var(--dash-foreground)]">
                  {entry.name}
                </p>
                <p className="text-xs text-[var(--dash-muted)]">
                  {entry.value} {entry.value === 1 ? "like" : "likes"}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
