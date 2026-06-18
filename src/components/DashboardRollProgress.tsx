import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getSavedLikes, getRecentRolls } from "../lib/userData";

export default function DashboardRollProgress() {
  const { user } = useAuth();
  const [percent, setPercent] = useState(0);
  const [saved, setSaved] = useState(0);
  const [rated, setRated] = useState(0);
  const [rolls, setRolls] = useState(0);

  useEffect(() => {
    if (!user?.id) {
      setPercent(0);
      setSaved(0);
      setRated(0);
      setRolls(0);
      return;
    }

    const refresh = () => {
      const likes = getSavedLikes();
      const ratedCount = likes.filter((l) => l.rating).length;
      const total = likes.length;
      setSaved(total);
      setRated(ratedCount);
      setRolls(getRecentRolls().length);
      setPercent(total === 0 ? 0 : Math.round((ratedCount / total) * 100));
    };
    refresh();
    window.addEventListener("user-data:update", refresh);
    return () => window.removeEventListener("user-data:update", refresh);
  }, [user?.id]);

  const dash = 251;
  const offset = dash - (dash * percent) / 100;

  return (
    <section className="dashboard-panel flex flex-col p-5">
      <h2 className="text-lg font-bold text-[var(--dash-foreground)]">
        Your progress
      </h2>
      <p className="mt-1 text-sm text-[var(--dash-muted)]">
        Rated favorites vs saved likes
      </p>

      <div className="relative mx-auto my-4 flex h-36 w-full max-w-[220px] items-end justify-center">
        <svg viewBox="0 0 200 110" className="h-full w-full" aria-hidden>
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="var(--dash-border)"
            strokeWidth="16"
            strokeLinecap="round"
          />
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="var(--accent-cyan)"
            strokeWidth="16"
            strokeLinecap="round"
            strokeDasharray={dash}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute bottom-2 text-center">
          <p className="text-3xl font-bold text-[var(--dash-foreground)]">
            {percent}%
          </p>
          <p className="text-xs text-[var(--dash-muted)]">Rated</p>
        </div>
      </div>

      <ul className="mt-auto space-y-2 text-sm">
        <li className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-[var(--dash-muted)]">
            <span className="h-2.5 w-2.5 rounded-full bg-cyan" />
            Rated
          </span>
          <span className="font-semibold">{rated}</span>
        </li>
        <li className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-[var(--dash-muted)]">
            <span className="h-2.5 w-2.5 rounded-full bg-cyan/20 ring-1 ring-cyan/30" />
            Saved
          </span>
          <span className="font-semibold">{saved}</span>
        </li>
        <li className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-[var(--dash-muted)]">
            <span className="dash-chart-bar-empty inline-block h-2.5 w-2.5 rounded-full" />
            Rolls
          </span>
          <span className="font-semibold">{rolls}</span>
        </li>
      </ul>
    </section>
  );
}
