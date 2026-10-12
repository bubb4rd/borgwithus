import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLikes } from "../context/LikesContext";

function Heart() {
  return (
    <svg className="like-heart" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.1 0 3.6 1.2 4.4 2.6.2.4.6.4.8 0 .8-1.4 2.3-2.6 4.4-2.6 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21Z" />
    </svg>
  );
}

// The mirror of DislikeButton's thumbs down.
function ThumbUp() {
  return (
    <svg className="like-heart" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 10v12" />
      <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
    </svg>
  );
}

// Pass `count` to show the like total (leaderboard rows) instead of a "Like" label.
// `compact` (the jug configurator) is a thumbs up with no label, matching the compact 👎.
// `disabled` shows the button greyed out with nothing to like yet (`name` can be null then).
// Signed-out visitors see a counted total read-only; uncounted buttons become a link to log
// in that brings them back to `from`.
export default function LikeButton({ name, count, from = "/", compact = false, disabled = false }) {
  const { user, online } = useAuth();
  const { liked, toggleLike } = useLikes();
  if (!online) return null;

  const isLiked = !disabled && liked.has(name);
  const content = (
    <>
      {compact ? <ThumbUp /> : <Heart />}
      {!compact && <span>{count ?? (isLiked ? "Liked" : "Like")}</span>}
    </>
  );
  const countLabel = count === undefined ? "" : `, ${count} ${count === 1 ? "like" : "likes"}`;
  const className = `like-btn${compact ? " is-icon" : ""}`;

  if (disabled) {
    return (
      <button type="button" className={className} disabled aria-label="Like" title="Nothing to like yet">
        {content}
      </button>
    );
  }

  if (!user) {
    if (count !== undefined) {
      return (
        <span className="like-count" role="img" aria-label={`${count} ${count === 1 ? "like" : "likes"}`}>
          {content}
        </span>
      );
    }
    return (
      <Link
        to="/login"
        state={{ from }}
        className={className}
        aria-label={`Log in to like ${name}${countLabel}`}
        title={compact ? "Log in to like" : undefined}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={`${className}${isLiked ? " is-liked" : ""}`}
      aria-pressed={isLiked}
      aria-label={`Like ${name}${countLabel}`}
      title={compact ? (isLiked ? "Liked" : "Like") : undefined}
      onClick={() => toggleLike(name)}
    >
      {content}
    </button>
  );
}
