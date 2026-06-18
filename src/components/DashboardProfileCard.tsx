import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  formatMemberSince,
  getDashboardStats,
  getInitials,
} from "../lib/userStats";

type Stats = ReturnType<typeof getDashboardStats>;

const STAT_ITEMS: {
  key: keyof Stats;
  label: string;
}[] = [
  { key: "savedPicks", label: "Saved picks" },
  { key: "communityPicks", label: "Pick votes" },
  { key: "generations", label: "Borgs Generated" },
  { key: "rated", label: "Borgs Rated" },
];

export default function DashboardProfileCard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>(getDashboardStats);

  useEffect(() => {
    const refresh = () => setStats(getDashboardStats());
    window.addEventListener("user-data:update", refresh);
    return () => window.removeEventListener("user-data:update", refresh);
  }, []);

  if (!user) return null;

  return (
    <section className="dashboard-panel flex h-full flex-col p-5">
      <div className="flex items-start gap-4">
        <div
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-cyan/15 text-xl font-bold text-cyan"
          aria-hidden
        >
          {getInitials(user.name)}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-magenta">
            Profile
          </p>
          <h2 className="mt-1 truncate text-xl font-bold text-foreground">
            {user.name}
          </h2>
          <p className="truncate text-sm text-muted">{user.email}</p>
        </div>
      </div>

      <dl className="mt-5 grid flex-1 grid-cols-2 content-start gap-3">
        {STAT_ITEMS.map(({ key, label }) => (
          <div
            key={key}
            className="rounded-lg border border-border/60 bg-background/40 px-3 py-2.5"
          >
            <dt className="text-xs text-subtle">{label}</dt>
            <dd className="mt-0.5 text-2xl font-bold tabular-nums text-foreground">
              {stats[key]}
            </dd>
          </div>
        ))}
      </dl>

      <p className="mt-3 text-center text-xs text-subtle">
        Member since {formatMemberSince(user.memberSince)}
      </p>
    </section>
  );
}
