const PICKS_KEY = "borgwithus-picks";

export type LeaderboardMetric = "picks" | "rating";

export type LeaderboardEntry = {
  name: string;
  value: number;
  detail?: string;
};

const PICKS_SEED: Record<string, number> = {
  "Ron Borgundy": 2847,
  "LeBorg James": 2103,
  "SpongeBorg": 1891,
  "Borgan Freeman": 1654,
  "Heisenborg": 1420,
  "Borgzilla": 1288,
};

const RATING_SEED: Record<string, { avg: number; count: number }> = {
  "SpongeBorg": { avg: 4.9, count: 312 },
  "Ron Borgundy": { avg: 4.8, count: 428 },
  "Borgan Freeman": { avg: 4.7, count: 256 },
  "LeBorg James": { avg: 4.6, count: 198 },
  "Heisenborg": { avg: 4.5, count: 174 },
  "Borgzilla": { avg: 4.4, count: 143 },
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

function saveExtra(key: string, data: Record<string, number>) {
  localStorage.setItem(key, JSON.stringify(data));
}

function bumpCount(key: string, name: string) {
  const extra = loadExtra(key);
  extra[name] = (extra[name] ?? 0) + 1;
  saveExtra(key, extra);
  window.dispatchEvent(new Event("leaderboard:update"));
}

export function recordPick(name: string) {
  bumpCount(PICKS_KEY, name);
}

function mergeCounts(
  seed: Record<string, number>,
  key: string
): Map<string, number> {
  const extra = loadExtra(key);
  const totals = new Map<string, number>();

  for (const [name, count] of Object.entries(seed)) {
    totals.set(name, count + (extra[name] ?? 0));
  }
  for (const [name, count] of Object.entries(extra)) {
    if (!seed[name]) totals.set(name, count);
  }

  return totals;
}

function topFromCounts(
  totals: Map<string, number>,
  limit: number,
  formatDetail?: (name: string, value: number) => string | undefined
): LeaderboardEntry[] {
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, value]) => ({
      name,
      value,
      detail: formatDetail?.(name, value),
    }));
}

export function getTopEntries(
  metric: LeaderboardMetric,
  limit = 3
): LeaderboardEntry[] {
  if (metric === "picks") {
    return topFromCounts(mergeCounts(PICKS_SEED, PICKS_KEY), limit);
  }

  return Object.entries(RATING_SEED)
    .sort((a, b) => b[1].avg - a[1].avg)
    .slice(0, limit)
    .map(([name, { avg, count }]) => ({
      name,
      value: avg,
      detail: `${count} ratings`,
    }));
}

export const METRIC_LABELS: Record<
  LeaderboardMetric,
  { label: string; description: string }
> = {
  picks: {
    label: "Picks",
    description: "Names chosen most often by the community.",
  },
  rating: {
    label: "Rating",
    description: "Top-rated names from signed-up members.",
  },
};
