import {
  getBorgOfTheDay,
  getDayKey,
  getLikeCount,
  recordLike,
  recordRating,
} from "./leaderboard";
import { addSavedLike } from "./userData";

const BOTD_KEY = "borgwithus-botd";

type BotdState = {
  day: string;
  liked?: boolean;
  picked?: boolean;
  rating?: number;
};

function loadState(): BotdState | null {
  try {
    const raw = localStorage.getItem(BOTD_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as BotdState;
  } catch {
    return null;
  }
}

function saveState(state: BotdState) {
  localStorage.setItem(BOTD_KEY, JSON.stringify(state));
}

function getTodayState(date = new Date()): BotdState {
  const day = getDayKey(date);
  const existing = loadState();
  if (existing?.day === day) {
    return {
      ...existing,
      liked: existing.liked ?? existing.picked,
    };
  }
  return { day };
}

export function hasLikedBorgOfTheDay(date = new Date()) {
  const state = getTodayState(date);
  return state.liked === true;
}

export function getBorgOfTheDayRating(date = new Date()) {
  return getTodayState(date).rating ?? 0;
}

export function likeBorgOfTheDay(date = new Date()) {
  const state = getTodayState(date);
  if (state.liked) return getBorgOfTheDay(date);

  const name = getBorgOfTheDay(date);
  recordLike(name);
  addSavedLike(name);
  saveState({ ...state, liked: true });
  return name;
}

export function rateBorgOfTheDay(stars: number, date = new Date()) {
  const state = getTodayState(date);
  if (state.rating) return getBorgOfTheDay(date);

  const name = getBorgOfTheDay(date);
  recordRating(name, stars);
  saveState({ ...state, rating: stars });
  return name;
}

export function getBorgOfTheDayStats(date = new Date()) {
  const state = getTodayState(date);
  const name = getBorgOfTheDay(date);
  return {
    name,
    likeCount: getLikeCount(name),
    liked: state.liked === true,
    rating: state.rating ?? 0,
    rated: state.rating !== undefined,
  };
}
