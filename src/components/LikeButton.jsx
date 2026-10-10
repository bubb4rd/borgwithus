import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLikes } from "../context/LikesContext";

// Pass `count` to show the like total (leaderboard rows) instead of a "Like" label.
// Signed-out visitors see a counted total read-only; uncounted buttons become a link to log
// in that brings them back to `from`.
export default function LikeButton({ name, count, from = "/" }) {
  const { user, online } = useAuth();
  const { liked, toggleLike } = useLikes();
  if (!online) return null;

  const isLiked = liked.has(name);
  const content = (
    <>
      <svg className="like-heart" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.1 0 3.6 1.2 4.4 2.6.2.4.6.4.8 0 .8-1.4 2.3-2.6 4.4-2.6 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21Z" />
      </svg>
      <span>{count ?? (isLiked ? "Liked" : "Like")}</span>
    </>
  );
  const countLabel = count === undefined ? "" : `, ${count} ${count === 1 ? "like" : "likes"}`;

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
        className="like-btn"
        aria-label={`Log in to like ${name}${countLabel}`}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={`like-btn${isLiked ? " is-liked" : ""}`}
      aria-pressed={isLiked}
      aria-label={`Like ${name}${countLabel}`}
      onClick={() => toggleLike(name)}
    >
      {content}
    </button>
  );
}
