import { recordRating } from "./leaderboard";

export type RollType = "borg" | "mio" | "ai";

export type SavedPick = {
  id: string;
  name: string;
  pickedAt: string;
  rating?: number;
};

export type RecentRoll = {
  id: string;
  name: string;
  type: RollType;
  rolledAt: string;
};

const SAVED_PICKS_KEY = "borgwithus-saved-picks";
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

export function getSavedPicks(): SavedPick[] {
  return loadJson<SavedPick[]>(SAVED_PICKS_KEY, []);
}

export function addSavedPick(name: string) {
  const picks = getSavedPicks();
  picks.unshift({
    id: uid(),
    name,
    pickedAt: new Date().toISOString(),
  });
  localStorage.setItem(SAVED_PICKS_KEY, JSON.stringify(picks));
  notify();
}

export function rateSavedPick(id: string, rating: number) {
  const picks = getSavedPicks().map((pick) =>
    pick.id === id ? { ...pick, rating } : pick
  );
  localStorage.setItem(SAVED_PICKS_KEY, JSON.stringify(picks));

  const pick = picks.find((p) => p.id === id);
  if (pick) recordRating(pick.name, rating);
  notify();
}

export function removeSavedPick(id: string) {
  const picks = getSavedPicks().filter((pick) => pick.id !== id);
  localStorage.setItem(SAVED_PICKS_KEY, JSON.stringify(picks));
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
