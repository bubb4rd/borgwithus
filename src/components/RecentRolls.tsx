import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ScrollHintList from "./ScrollHintList";
import {
  formatRelativeTime,
  getRecentRolls,
  ROLL_LABELS,
  type RecentRoll,
} from "../lib/userData";

const TYPE_STYLES = {
  borg: "text-cyan bg-cyan/10 border-cyan/20",
  mio: "text-magenta bg-magenta/10 border-magenta/20",
  ai: "text-hazard bg-hazard/10 border-hazard/20",
} as const;

const TEASER_MASK =
  "pointer-events-none select-none overflow-hidden [mask-image:linear-gradient(to_bottom,black_0%,black_32%,transparent_68%)] [-webkit-mask-image:linear-gradient(to_bottom,black_0%,black_32%,transparent_68%)]";

function RollItem({
  roll,
  emphasized = false,
}: {
  roll: RecentRoll;
  emphasized?: boolean;
}) {
  return (
    <div
      className={`flex min-w-0 items-center gap-3 rounded-xl border bg-elevated ${
        emphasized
          ? "highlight-entry px-3.5 py-3"
          : "border-border px-3 py-2.5"
      }`}
    >
      <span
        className={`shrink-0 rounded-md border font-bold uppercase tracking-wider ${TYPE_STYLES[roll.type]} ${
          emphasized
            ? "px-2.5 py-1 text-[0.7rem]"
            : "px-2 py-0.5 text-[0.65rem]"
        }`}
      >
        {ROLL_LABELS[roll.type]}
      </span>
      <p
        className={`min-w-0 flex-1 truncate font-medium text-foreground ${
          emphasized ? "text-base" : "text-sm"
        }`}
      >
        {roll.name}
      </p>
      <span
        className={`shrink-0 text-subtle ${emphasized ? "text-sm" : "text-xs"}`}
      >
        {formatRelativeTime(roll.rolledAt)}
      </span>
    </div>
  );
}

type RecentRollsProps = {
  limit?: number;
  viewAllHref?: string;
  scrollable?: boolean;
  scrollHeight?: number;
};

export default function RecentRolls({
  limit,
  viewAllHref,
  scrollable = false,
  scrollHeight,
}: RecentRollsProps) {
  const { user } = useAuth();
  const [rolls, setRolls] = useState<RecentRoll[]>([]);

  useEffect(() => {
    if (!user?.id) {
      setRolls([]);
      return;
    }

    const refresh = () => setRolls(getRecentRolls());
    refresh();
    window.addEventListener("user-data:update", refresh);
    return () => window.removeEventListener("user-data:update", refresh);
  }, [user?.id]);

  const visible = limit ? rolls.slice(0, limit) : rolls;
  const teaserRoll =
    limit !== undefined && rolls.length > limit ? rolls[limit] : undefined;
  const hasMore = limit !== undefined && rolls.length > limit;

  return (
    <section
      id="recent-rolls"
      className={`dashboard-panel flex min-w-0 flex-col overflow-hidden p-5 ${
        scrollable && !scrollHeight ? "h-full min-h-0 overflow-hidden" : "h-full"
      }`}
    >
      <div className={`mb-4 ${scrollable ? "shrink-0" : ""}`}>
        <p className="dash-eyebrow text-lime">History</p>
        <h2 className="mt-1 text-xl font-bold text-foreground">Recent rolls</h2>
      </div>

      {visible.length === 0 ? (
        <p className="flex-1 text-sm text-subtle">
          Your latest borg, Mio, and AI names will show up here.
        </p>
      ) : scrollable ? (
        <ScrollHintList height={scrollHeight} refreshDeps={[visible.length]}>
          <ul className="min-w-0 space-y-2">
            {visible.map((roll) => (
              <li
                key={roll.id}
                className="flex min-w-0 items-center gap-3 rounded-xl border border-border bg-elevated px-3 py-2.5"
              >
                <span
                  className={`shrink-0 rounded-md border px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider ${TYPE_STYLES[roll.type]}`}
                >
                  {ROLL_LABELS[roll.type]}
                </span>
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                  {roll.name}
                </p>
                <span className="shrink-0 text-xs text-subtle">
                  {formatRelativeTime(roll.rolledAt)}
                </span>
              </li>
            ))}
          </ul>
        </ScrollHintList>
      ) : (
        <div className="relative min-h-0 flex-1">
          <ul className="space-y-2">
            {visible.map((roll, index) => (
              <li key={roll.id}>
                <RollItem roll={roll} emphasized={index === 0} />
              </li>
            ))}
            {teaserRoll && (
              <li className={TEASER_MASK} aria-hidden>
                <RollItem roll={teaserRoll} />
              </li>
            )}
          </ul>
        </div>
      )}

      {viewAllHref && (hasMore || rolls.length > 0) && (
        <Link
          to={viewAllHref}
          className="mt-auto pt-4 text-center text-sm font-medium text-cyan transition-colors hover:underline"
        >
          {hasMore ? `View all ${rolls.length} rolls` : "View history"}
        </Link>
      )}
    </section>
  );
}
