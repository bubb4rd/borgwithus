import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ScrollHintList from "./ScrollHintList";
import StarRating from "./StarRating";
import {
  formatRelativeTime,
  getSavedLikes,
  rateSavedLike,
  removeSavedLike,
  type SavedLike,
} from "../lib/userData";

type SavedLikesProps = {
  limit?: number;
  viewAllHref?: string;
  scrollable?: boolean;
  scrollHeight?: number;
};

export default function SavedLikes({
  limit,
  viewAllHref,
  scrollable = false,
  scrollHeight,
}: SavedLikesProps) {
  const [likes, setLikes] = useState<SavedLike[]>(getSavedLikes);

  useEffect(() => {
    const refresh = () => setLikes(getSavedLikes());
    window.addEventListener("user-data:update", refresh);
    return () => window.removeEventListener("user-data:update", refresh);
  }, []);

  const visible = limit ? likes.slice(0, limit) : likes;
  const hasMore = limit !== undefined && likes.length > limit;

  const likesList = (
    <ul className="space-y-3">
      {visible.map((like) => (
        <li
          key={like.id}
          className="rounded-2xl border border-border bg-elevated p-3"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="min-w-0 truncate font-semibold text-foreground">
              {like.name}
            </span>
            <span className="shrink-0 text-subtle" aria-hidden>
              ·
            </span>
            <span className="shrink-0 text-xs text-subtle">
              {formatRelativeTime(like.likedAt)}
            </span>
            <button
              type="button"
              onClick={() => removeSavedLike(like.id)}
              aria-label="Remove like"
              className="ml-auto shrink-0 cursor-pointer rounded-lg px-2 py-0.5 text-lg leading-none text-muted transition-colors hover:bg-hover hover:text-foreground"
            >
              ×
            </button>
          </div>
          <div className="mt-2">
            <StarRating
              size="md"
              value={like.rating ?? 0}
              onChange={(rating) => rateSavedLike(like.id, rating)}
            />
          </div>
        </li>
      ))}
    </ul>
  );

  return (
    <section
      id="saved-likes"
      className={`dashboard-panel flex flex-col p-5 ${
        scrollable && !scrollHeight ? "h-full min-h-0 overflow-hidden" : "h-full"
      }`}
    >
      <div className={`mb-4 ${scrollable ? "shrink-0" : ""}`}>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan">
          Your likes
        </p>
        <h2 className="mt-1 text-xl font-bold text-foreground">Saved likes</h2>
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-subtle">
          Like a borg from the generator to save it here.
        </p>
      ) : scrollable ? (
        <ScrollHintList
          height={scrollHeight}
          refreshDeps={[visible.length]}
        >
          {likesList}
        </ScrollHintList>
      ) : (
        likesList
      )}

      {viewAllHref && (hasMore || likes.length > 0) && (
        <Link
          to={viewAllHref}
          className="mt-4 text-center text-sm font-medium text-cyan transition-colors hover:underline"
        >
          {hasMore ? `View all ${likes.length} likes` : "View history"}
        </Link>
      )}
    </section>
  );
}
