import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ScrollHintList from "./ScrollHintList";
import StarRating from "./StarRating";
import {
  formatRelativeTime,
  getSavedPicks,
  rateSavedPick,
  removeSavedPick,
  type SavedPick,
} from "../lib/userData";

type SavedPicksProps = {
  limit?: number;
  viewAllHref?: string;
  scrollable?: boolean;
  scrollHeight?: number;
};

export default function SavedPicks({
  limit,
  viewAllHref,
  scrollable = false,
  scrollHeight,
}: SavedPicksProps) {
  const [picks, setPicks] = useState<SavedPick[]>(getSavedPicks);

  useEffect(() => {
    const refresh = () => setPicks(getSavedPicks());
    window.addEventListener("user-data:update", refresh);
    return () => window.removeEventListener("user-data:update", refresh);
  }, []);

  const visible = limit ? picks.slice(0, limit) : picks;
  const hasMore = limit !== undefined && picks.length > limit;

  const picksList = (
    <ul className="space-y-3">
      {visible.map((pick) => (
        <li
          key={pick.id}
          className="rounded-2xl border border-border bg-elevated p-3"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="min-w-0 truncate font-semibold text-foreground">
              {pick.name}
            </span>
            <span className="shrink-0 text-subtle" aria-hidden>
              ·
            </span>
            <span className="shrink-0 text-xs text-subtle">
              {formatRelativeTime(pick.pickedAt)}
            </span>
            <button
              type="button"
              onClick={() => removeSavedPick(pick.id)}
              aria-label="Remove pick"
              className="ml-auto shrink-0 cursor-pointer rounded-lg px-2 py-0.5 text-lg leading-none text-muted transition-colors hover:bg-hover hover:text-foreground"
            >
              ×
            </button>
          </div>
          <div className="mt-2">
            <StarRating
              size="md"
              value={pick.rating ?? 0}
              onChange={(rating) => rateSavedPick(pick.id, rating)}
            />
          </div>
        </li>
      ))}
    </ul>
  );

  return (
    <section
      id="saved-picks"
      className={`dashboard-panel flex flex-col p-5 ${
        scrollable && !scrollHeight ? "h-full min-h-0 overflow-hidden" : "h-full"
      }`}
    >
      <div className={`mb-4 ${scrollable ? "shrink-0" : ""}`}>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan">
          Your picks
        </p>
        <h2 className="mt-1 text-xl font-bold text-foreground">Saved picks</h2>
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-subtle">
          Pick a borg from the generator to save it here.
        </p>
      ) : scrollable ? (
        <ScrollHintList
          height={scrollHeight}
          refreshDeps={[visible.length]}
        >
          {picksList}
        </ScrollHintList>
      ) : (
        picksList
      )}

      {viewAllHref && (hasMore || picks.length > 0) && (
        <Link
          to={viewAllHref}
          className="mt-4 text-center text-sm font-medium text-cyan transition-colors hover:underline"
        >
          {hasMore ? `View all ${picks.length} picks` : "View history"}
        </Link>
      )}
    </section>
  );
}
