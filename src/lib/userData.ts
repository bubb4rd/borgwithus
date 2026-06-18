import { recordRating } from "./leaderboard";

export type RollType = "borg" | "mio" | "ai";

export type SavedLike = {
  id: string;
  name: string;
  likedAt: string;
  rating?: number;
};

type LegacySavedLike = {
  id: string;
  name: string;
  pickedAt?: string;
  likedAt?: string;
  rating?: number;
};

export type RecentRoll = {
  id: string;
  name: string;
  type: RollType;
  rolledAt: string;
};

const SAVED_LIKES_KEY = "borgwithus-saved-likes";
const LEGACY_SAVED_PICKS_KEY = "borgwithus-saved-picks";
const RECENT_ROLLS_KEY = "borgwithus-recent-rolls";
export const PREVIEW_LIMIT = 5;
const MAX_STORED_ROLLS = 100;

function notify() {
  window.dispatchEvent(new Event("user-data:update"));
}

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function uid() {
  return crypto.randomUUID();
}

function migrateSavedLikes(): SavedLike[] {
  const legacy = loadJson<LegacySavedLike[]>(LEGACY_SAVED_PICKS_KEY, []);
  if (legacy.length === 0) return [];

  const migrated = legacy.map((entry) => ({
    id: entry.id,
    name: entry.name,
    likedAt: entry.likedAt ?? entry.pickedAt ?? new Date().toISOString(),
    rating: entry.rating,
  }));
  localStorage.setItem(SAVED_LIKES_KEY, JSON.stringify(migrated));
  return migrated;
}

export function getSavedLikes(): SavedLike[] {
  const likes = loadJson<SavedLike[]>(SAVED_LIKES_KEY, []);
  if (likes.length > 0) return likes;
  return migrateSavedLikes();
}

export function addSavedLike(name: string) {
  const likes = getSavedLikes();
  likes.unshift({
    id: uid(),
    name,
    likedAt: new Date().toISOString(),
  });
  localStorage.setItem(SAVED_LIKES_KEY, JSON.stringify(likes));
  notify();
}

export function rateSavedLike(id: string, rating: number) {
  const likes = getSavedLikes().map((like) =>
    like.id === id ? { ...like, rating } : like
  );
  localStorage.setItem(SAVED_LIKES_KEY, JSON.stringify(likes));

  const like = likes.find((entry) => entry.id === id);
  if (like) recordRating(like.name, rating);
  notify();
}

export function removeSavedLike(id: string) {
  const likes = getSavedLikes().filter((like) => like.id !== id);
  localStorage.setItem(SAVED_LIKES_KEY, JSON.stringify(likes));
  notify();
}

export function getRecentRolls(): RecentRoll[] {
  return loadJson<RecentRoll[]>(RECENT_ROLLS_KEY, []);
}

export function recordRoll(type: RollType, name: string) {
  const rolls = getRecentRolls().filter(
    (roll) => !(roll.type === type && roll.name === name)
  );
  rolls.unshift({
    id: uid(),
    name,
    type,
    rolledAt: new Date().toISOString(),
  });
  localStorage.setItem(
    RECENT_ROLLS_KEY,
    JSON.stringify(rolls.slice(0, MAX_STORED_ROLLS))
  );
  notify();
}

export function formatRelativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export const ROLL_LABELS: Record<RollType, string> = {
  borg: "BORG",
  mio: "MIO",
  ai: "AI",
};
