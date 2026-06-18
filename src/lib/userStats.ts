import { getLikesCastCount, getRecentRolls, getSavedLikes } from "./userData";

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
    likesCast: getLikesCastCount(),
    generations: getRecentRolls().length,
    rated: likes.filter((like) => like.rating).length,
  };
}
