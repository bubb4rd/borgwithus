import { getRecentRolls, getSavedLikes } from "./userData";

const LIKES_KEY = "borgwithus-likes";
const LEGACY_PICKS_KEY = "borgwithus-picks";

export function getUserLikeCount(): number {
  try {
    let raw = localStorage.getItem(LIKES_KEY);
    if (!raw) {
      raw = localStorage.getItem(LEGACY_PICKS_KEY);
    }
    if (!raw) return 0;
    const likes = JSON.parse(raw) as Record<string, number>;
    return Object.values(likes).reduce((sum, n) => sum + n, 0);
  } catch {
    return 0;
  }
}

export function formatMemberSince(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });
}

export function getInitials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function getDashboardStats() {
  const likes = getSavedLikes();
  return {
    savedLikes: likes.length,
    likesCast: getUserLikeCount(),
    generations: getRecentRolls().length,
    rated: likes.filter((like) => like.rating).length,
  };
}
