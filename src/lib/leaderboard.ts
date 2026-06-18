import names from "../data/names.json";

const LIKES_KEY = "borgwithus-likes";
const LEGACY_PICKS_KEY = "borgwithus-picks";
const RATINGS_KEY = "borgwithus-ratings";

export type LeaderboardMetric = "likes" | "rating";

export type LeaderboardEntry = {
  name: string;
  value: number;
  detail?: string;
};

type RatingAggregate = { total: number; count: number };

function loadExtra(key: string): Record<string, number> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return {};
    return parsed as Record<string, number>;
  } catch {
    return {};
  }
}

function loadLikesExtra(): Record<string, number> {
  const likes = loadExtra(LIKES_KEY);
  if (Object.keys(likes).length > 0) return likes;

  const legacy = loadExtra(LEGACY_PICKS_KEY);
  if (Object.keys(legacy).length === 0) return {};

  saveExtra(LIKES_KEY, legacy);
  return legacy;
}

function loadRatings(): Record<string, RatingAggregate> {
  try {
    const raw = localStorage.getItem(RATINGS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, RatingAggregate>;
  } catch {
    return {};
  }
}

function saveExtra(key: string, data: Record<string, number>) {
  localStorage.setItem(key, JSON.stringify(data));
}

function saveRatings(data: Record<string, RatingAggregate>) {
  localStorage.setItem(RATINGS_KEY, JSON.stringify(data));
}

function bumpCount(key: string, name: string) {
  const extra = loadLikesExtra();
  extra[name] = (extra[name] ?? 0) + 1;
  saveExtra(key, extra);
}

function notifyLeaderboard() {
  window.dispatchEvent(new Event("leaderboard:update"));
}

export function recordLike(name: string) {
  bumpCount(LIKES_KEY, name);
  notifyLeaderboard();
  window.dispatchEvent(new Event("user-data:update"));
}

export function getLikeCount(name: string): number {
  return loadLikesExtra()[name] ?? 0;
}

export function getNameRatingStats(name: string): {
  average: number;
  count: number;
} {
  const entry = loadRatings()[name];
  if (!entry?.count) return { average: 0, count: 0 };
  return { average: entry.total / entry.count, count: entry.count };
}

function hashDayKey(dayKey: string): number {
  let hash = 0;
  for (let i = 0; i < dayKey.length; i++) {
    hash = (hash * 31 + dayKey.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function getDayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getBorgOfTheDay(date = new Date()): string {
  const pool = names.borg;
  if (pool.length === 0) return "Borg";
  const dayKey = getDayKey(date);
  return pool[hashDayKey(dayKey) % pool.length];
}

export function recordRating(name: string, stars: number) {
  const ratings = loadRatings();
  const current = ratings[name] ?? { total: 0, count: 0 };
  ratings[name] = {
    total: current.total + stars,
    count: current.count + 1,
  };
  saveRatings(ratings);
  notifyLeaderboard();
  window.dispatchEvent(new Event("user-data:update"));
}

function topFromCounts(
  totals: Map<string, number>,
  limit: number
): LeaderboardEntry[] {
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, value]) => ({ name, value }));
}

export function getTopEntries(
  metric: LeaderboardMetric,
  limit = 10
): LeaderboardEntry[] {
  if (metric === "likes") {
    return topFromCounts(new Map(Object.entries(loadLikesExtra())), limit);
  }

  return Object.entries(loadRatings())
    .map(([name, { total, count }]) => ({
      name,
      avg: count ? total / count : 0,
      count,
    }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, limit)
    .map(({ name, avg, count }) => ({
      name,
      value: avg,
      detail: `${count} ratings`,
    }));
}

export const METRIC_LABELS: Record<
  LeaderboardMetric,
  { label: string; description: string }
> = {
  likes: {
    label: "Likes",
    description: "Names liked most often by the community.",
  },
  rating: {
    label: "Rating",
    description: "Top-rated names from signed-up members.",
  },
};
