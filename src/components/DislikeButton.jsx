import React from "react";
import { useAuth } from "../context/AuthContext";
import { useDislikes } from "../context/DislikesContext";
import { useLikes } from "../context/LikesContext";

// 👎 for a BORG AI name, signed-in members only. Disliking a liked name drops the like.
export default function DislikeButton({ name }) {
  const { user, online } = useAuth();
  const { liked, toggleLike } = useLikes();
  const { disliked, toggleDislike } = useDislikes();
  if (!online || !user) return null;

  const isDisliked = disliked.has(name);
  const onClick = () => {
    if (!isDisliked && liked.has(name)) toggleLike(name);
    toggleDislike(name);
  };

  return (
    <button
      type="button"
      className={`like-btn${isDisliked ? " is-disliked" : ""}`}
      aria-pressed={isDisliked}
      aria-label={`Dislike ${name}`}
      onClick={onClick}
    >
      <svg className="like-heart" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M17 14V2" />
        <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z" />
      </svg>
      <span>{isDisliked ? "Disliked" : "Dislike"}</span>
    </button>
  );
}
