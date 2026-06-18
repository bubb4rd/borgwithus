import { getRecentRolls, getSavedPicks } from "./userData";

const PICKS_KEY = "borgwithus-picks";

export function getUserPickCount(): number {
  try {
    const raw = localStorage.getItem(PICKS_KEY);
    if (!raw) return 0;
    const picks = JSON.parse(raw) as Record<string, number>;
    return Object.values(picks).reduce((sum, n) => sum + n, 0);
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
  const picks = getSavedPicks();
  return {
    savedPicks: picks.length,
    communityPicks: getUserPickCount(),
    generations: getRecentRolls().length,
    rated: picks.filter((p) => p.rating).length,
  };
}
