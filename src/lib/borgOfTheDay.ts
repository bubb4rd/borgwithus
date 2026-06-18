import {
  getBorgOfTheDay,
  getDayKey,
  getPickCount,
  recordPick,
  recordRating,
} from "./leaderboard";
import { addSavedPick } from "./userData";

const BOTD_KEY = "borgwithus-botd";

type BotdState = {
  day: string;
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
  if (existing?.day === day) return existing;
  return { day };
}

export function hasPickedBorgOfTheDay(date = new Date()) {
  return getTodayState(date).picked === true;
}

export function getBorgOfTheDayRating(date = new Date()) {
  return getTodayState(date).rating ?? 0;
}

export function pickBorgOfTheDay(date = new Date()) {
  const state = getTodayState(date);
  if (state.picked) return getBorgOfTheDay(date);

  const name = getBorgOfTheDay(date);
  recordPick(name);
  addSavedPick(name);
  saveState({ ...state, picked: true });
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
    pickCount: getPickCount(name),
    picked: state.picked === true,
    rating: state.rating ?? 0,
    rated: state.rating !== undefined,
  };
}
