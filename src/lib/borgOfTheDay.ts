import {
  getBorgOfTheDay,
  getDayKey,
  getLikeCount,
  getNameRatingStats,
  recordLike,
  recordRating,
} from "./leaderboard";
import { saveRemoteBotdDay, type BotdDayRecord } from "./borgBotdSupabase";
import {
  getRemoteBotdHistory,
  upsertRemoteBotdHistoryRecord,
  usesRemoteBotdHistory,
} from "./sharedBorgData";
import { addSavedLike } from "./userData";
import { getActiveUserStorageId, userStorageKey } from "./userStorage";

const BOTD_BASE = "borgwithus-botd";
const HISTORY_KEY = "borgwithus-botd-history";

export type BestBorgOfTheDay = {
  day: string;
  name: string;
  likeCount: number;
  averageRating: number;
  ratingCount: number;
};

type BotdState = {
  day: string;
  liked?: boolean;
  picked?: boolean;
  rating?: number;
};

function loadState(): BotdState | null {
  if (!getActiveUserStorageId()) return null;

  try {
    const raw = localStorage.getItem(userStorageKey(BOTD_BASE));
    if (!raw) return null;
    return JSON.parse(raw) as BotdState;
  } catch {
    return null;
  }
}

function saveState(state: BotdState) {
  if (!getActiveUserStorageId()) return;
  localStorage.setItem(userStorageKey(BOTD_BASE), JSON.stringify(state));
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

function loadHistory(): Record<string, BotdDayRecord> {
  if (usesRemoteBotdHistory()) {
    return getRemoteBotdHistory();
  }

  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, BotdDayRecord>;
  } catch {
    return {};
  }
}

function persistHistoryRecord(record: BotdDayRecord, syncRemote = true) {
  if (usesRemoteBotdHistory()) {
    upsertRemoteBotdHistoryRecord(record);
    if (syncRemote) void saveRemoteBotdDay(record);
    return;
  }

  const history = loadHistory();
  history[record.day] = record;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function ensureDayRecord(date = new Date()): BotdDayRecord {
  const day = getDayKey(date);
  const name = getBorgOfTheDay(date);
  const history = loadHistory();
  const existing = history[day];

  if (existing?.name === name) {
    return existing;
  }

  const record: BotdDayRecord = {
    day,
    name,
    likeCount: existing?.likeCount ?? 0,
    ratingTotal: existing?.ratingTotal ?? 0,
    ratingCount: existing?.ratingCount ?? 0,
  };
  persistHistoryRecord(record);
  return record;
}

function bumpDayLike(date = new Date()) {
  const record = ensureDayRecord(date);
  persistHistoryRecord({ ...record, likeCount: record.likeCount + 1 });
}

function bumpDayRating(stars: number, date = new Date()) {
  const record = ensureDayRecord(date);
  persistHistoryRecord({
    ...record,
    ratingTotal: record.ratingTotal + stars,
    ratingCount: record.ratingCount + 1,
  });
}

function dayRecordStats(record: BotdDayRecord) {
  return {
    likeCount: record.likeCount,
    averageRating: record.ratingCount
      ? record.ratingTotal / record.ratingCount
      : 0,
    ratingCount: record.ratingCount,
  };
}

export function formatBorgOfTheDayDate(day: string) {
  const [year, month, dayOfMonth] = day.split("-").map(Number);
  return new Date(year, month - 1, dayOfMonth).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function rankBotdEntries(entries: BotdDayRecord[]) {
  return [...entries].sort((a, b) => {
    if (b.likeCount !== a.likeCount) return b.likeCount - a.likeCount;
    const avgA = a.ratingCount ? a.ratingTotal / a.ratingCount : 0;
    const avgB = b.ratingCount ? b.ratingTotal / b.ratingCount : 0;
    if (avgB !== avgA) return avgB - avgA;
    return b.ratingCount - a.ratingCount;
  });
}

function toBestEntry(record: BotdDayRecord): BestBorgOfTheDay {
  return {
    day: record.day,
    name: record.name,
    ...dayRecordStats(record),
  };
}

export function getBestBorgOfTheDayAllTime(date = new Date()): BestBorgOfTheDay {
  const today = getDayKey(date);
  ensureDayRecord(date);
  const entries = Object.values(loadHistory());
  const pastWinners = entries.filter(
    (entry) =>
      entry.day !== today && (entry.likeCount > 0 || entry.ratingCount > 0),
  );

  if (pastWinners.length > 0) {
    return toBestEntry(rankBotdEntries(pastWinners)[0]);
  }

  return toBestEntry(rankBotdEntries(entries)[0] ?? ensureDayRecord(date));
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
  bumpDayLike(date);
  saveState({ ...state, liked: true });
  return name;
}

export function rateBorgOfTheDay(stars: number, date = new Date()) {
  const state = getTodayState(date);
  if (state.rating) return getBorgOfTheDay(date);

  const name = getBorgOfTheDay(date);
  recordRating(name, stars);
  bumpDayRating(stars, date);
  saveState({ ...state, rating: stars });
  return name;
}

export function getBorgOfTheDayStats(date = new Date()) {
  const state = getTodayState(date);
  const name = getBorgOfTheDay(date);
  const { average, count } = getNameRatingStats(name);
  const dayRecord = ensureDayRecord(date);
  const dayStats = dayRecordStats(dayRecord);
  return {
    name,
    likeCount: getLikeCount(name),
    liked: state.liked === true,
    rating: state.rating ?? 0,
    rated: state.rating !== undefined,
    averageRating: average,
    ratingCount: count,
    dayStats,
  };
}
