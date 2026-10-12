import React from "react";
import { useAuth } from "../context/AuthContext";
import { useDislikes } from "../context/DislikesContext";
import { useLikes } from "../context/LikesContext";

// 👎 for a BORG AI name, signed-in members only. Disliking a liked name drops the like.
// `compact` (the jug configurator) shows the thumb alone, without the "Dislike" label.
// `disabled` shows it greyed out with nothing to rate yet (`name` can be null then).
export default function DislikeButton({ name, compact = false, disabled = false }) {
  const { user, online } = useAuth();
  const { liked, toggleLike } = useLikes();
  const { disliked, setDislike } = useDislikes();
  if (!online || !user) return null;

  // A name is liked or disliked, never both: a like always wins the display, so a stray row
  // left from a failed toggle can't light both thumbs at once.
  const isLiked = liked.has(name);
  const isDisliked = !disabled && !isLiked && disliked.has(name);
  const onClick = () => {
    if (isDisliked) {
      setDislike(name, false);
      return;
    }
    if (isLiked) toggleLike(name);
    setDislike(name, true);
  };

  return (
    <button
      type="button"
      className={`like-btn${compact ? " is-icon" : ""}${isDisliked ? " is-disliked" : ""}`}
      disabled={disabled}
      aria-pressed={disabled ? undefined : isDisliked}
      aria-label={disabled ? "Dislike" : `Dislike ${name}`}
      title={compact ? (disabled ? "Nothing to rate yet" : isDisliked ? "Disliked" : "Dislike") : undefined}
      onClick={onClick}
    >
      <svg className="like-heart" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M17 14V2" />
        <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z" />
      </svg>
      {!compact && <span>{isDisliked ? "Disliked" : "Dislike"}</span>}
    </button>
  );
}
