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

const LIKES_SEED: Record<string, number> = {
  "Ron Borgundy": 2847,
  "LeBorg James": 2103,
  "SpongeBorg": 1891,
  "Borgan Freeman": 1654,
  "Heisenborg": 1420,
  "Borgzilla": 1288,
  "Borg Washington": 1102,
  "CyBorg": 987,
  "Borganic": 854,
  "Hamborger": 721,
  "Borg Sumner": 698,
  "Borghini": 645,
  "Thor Borg": 612,
  "Borgan Donor": 589,
  "Borgito": 556,
  "FreeBorg": 523,
  "Borgle": 491,
  "Borgatelli": 468,
  "Borg Bunny": 445,
  "Borgahontas": 422,
  "Borg Simpson": 399,
  "Borgrito": 376,
  "Borg Knuckles": 353,
  "Borgward": 331,
  "Borgasaurus": 309,
};

const RATING_SEED: Record<string, RatingAggregate> = {
  "SpongeBorg": { total: 4.9 * 312, count: 312 },
  "Ron Borgundy": { total: 4.8 * 428, count: 428 },
  "Borgan Freeman": { total: 4.7 * 256, count: 256 },
  "LeBorg James": { total: 4.6 * 198, count: 198 },
  "Heisenborg": { total: 4.5 * 174, count: 174 },
  "Borgzilla": { total: 4.4 * 143, count: 143 },
  "Borg Washington": { total: 4.3 * 118, count: 118 },
  "CyBorg": { total: 4.2 * 96, count: 96 },
  "Borganic": { total: 4.1 * 84, count: 84 },
  "Hamborger": { total: 4.0 * 71, count: 71 },
  "Borg Sumner": { total: 3.9 * 68, count: 68 },
  "Borghini": { total: 3.9 * 64, count: 64 },
  "Thor Borg": { total: 3.8 * 61, count: 61 },
  "Borgan Donor": { total: 3.8 * 58, count: 58 },
  "Borgito": { total: 3.7 * 55, count: 55 },
  "FreeBorg": { total: 3.7 * 52, count: 52 },
  "Borgle": { total: 3.6 * 49, count: 49 },
  "Borgatelli": { total: 3.6 * 46, count: 46 },
  "Borg Bunny": { total: 3.5 * 44, count: 44 },
  "Borgahontas": { total: 3.5 * 42, count: 42 },
  "Borg Simpson": { total: 3.4 * 39, count: 39 },
  "Borgrito": { total: 3.4 * 37, count: 37 },
  "Borg Knuckles": { total: 3.3 * 35, count: 35 },
  "Borgward": { total: 3.3 * 33, count: 33 },
  "Borgasaurus": { total: 3.2 * 31, count: 31 },
};

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
  return mergeCounts(LIKES_SEED, LIKES_KEY).get(name) ?? 0;
}

const BORG_OF_THE_DAY_NAMES = Object.keys(LIKES_SEED);

function hashDayKey(dayKey: string): number {
  let hash = 0;
  for (let i = 0; i < dayKey.length; i++) {
    hash = (hash * 31 + dayKey.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function getDayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function getBorgOfTheDay(date = new Date()): string {
  const dayKey = getDayKey(date);
  return BORG_OF_THE_DAY_NAMES[hashDayKey(dayKey) % BORG_OF_THE_DAY_NAMES.length];
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

function mergeCounts(
  seed: Record<string, number>,
  key: string
): Map<string, number> {
  const extra = key === LIKES_KEY ? loadLikesExtra() : loadExtra(key);
  const totals = new Map<string, number>();

  for (const [name, count] of Object.entries(seed)) {
    totals.set(name, count + (extra[name] ?? 0));
  }
  for (const [name, count] of Object.entries(extra)) {
    if (!seed[name]) totals.set(name, count);
  }

  return totals;
}

function mergeRatings(): Map<string, RatingAggregate> {
  const totals = new Map<string, RatingAggregate>();

  for (const [name, seed] of Object.entries(RATING_SEED)) {
    totals.set(name, { ...seed });
  }

  for (const [name, local] of Object.entries(loadRatings())) {
    const existing = totals.get(name);
    if (existing) {
      totals.set(name, {
        total: existing.total + local.total,
        count: existing.count + local.count,
      });
    } else {
      totals.set(name, local);
    }
  }

  return totals;
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
    return topFromCounts(mergeCounts(LIKES_SEED, LIKES_KEY), limit);
  }

  return [...mergeRatings().entries()]
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
