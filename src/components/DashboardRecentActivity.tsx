import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  formatRelativeTime,
  getRecentRolls,
  ROLL_LABELS,
  type RecentRoll,
} from "../lib/userData";

const STATUS_STYLES = {
  borg: "bg-cyan/10 text-cyan",
  mio: "bg-[#f3e8ff] text-[#7c3aed]",
  ai: "bg-[#ffedd5] text-[#c2410c]",
} as const;

export default function DashboardRecentActivity() {
  const [rolls, setRolls] = useState<RecentRoll[]>([]);

  useEffect(() => {
    const refresh = () => setRolls(getRecentRolls().slice(0, 4));
    refresh();
    window.addEventListener("user-data:update", refresh);
    return () => window.removeEventListener("user-data:update", refresh);
  }, []);

  return (
    <section className="dashboard-panel p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-[var(--dash-foreground)]">
          Recent activity
        </h2>
        <Link
          to="/dashboard/history"
          className="text-sm font-medium text-cyan hover:underline"
        >
          + Add
        </Link>
      </div>

      {rolls.length === 0 ? (
        <p className="text-sm text-[var(--dash-muted)]">
          No rolls yet. Hit the generator to get started.
        </p>
      ) : (
        <ul className="space-y-3">
          {rolls.map((roll) => (
            <li
              key={roll.id}
              className="flex items-center gap-3 border-b border-[var(--dash-border)] pb-3 last:border-b-0 last:pb-0"
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold ${STATUS_STYLES[roll.type]}`}
                aria-hidden
              >
                {ROLL_LABELS[roll.type].slice(0, 1)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[var(--dash-foreground)]">
                  {roll.name}
                </p>
                <p className="text-xs text-[var(--dash-muted)]">
                  {formatRelativeTime(roll.rolledAt)}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[0.65rem] font-semibold ${STATUS_STYLES[roll.type]}`}
              >
                {ROLL_LABELS[roll.type]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
