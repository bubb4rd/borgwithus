import { getCatalogCounts } from "./borgCatalog";
import { fetchAdminAiGenerations } from "./adminAiGenerations";
import { fetchCommunityStatsFromSupabase } from "./leaderboardSupabase";
import { hydrateSharedBorgData, setCommunitySyncRemote } from "./sharedBorgData";
import { getSupabase, isSupabaseConfigured } from "./supabase";
import type { RecentRoll, RollType } from "./userData";

const LIKES_KEY = "borgwithus-likes";
const LEGACY_PICKS_KEY = "borgwithus-picks";
const RATINGS_KEY = "borgwithus-ratings";

const USER_KEY_PREFIXES = [
  "borgwithus-saved-likes:",
  "borgwithus-recent-rolls:",
  "borgwithus-botd:",
  "borgwithus-likes-cast:",
] as const;

export type AdminProfile = {
  id: string;
  member_since: string;
};

export type AdminRoll = {
  id: string;
  name: string;
  roll_type: RollType;
  rolled_at: string;
};

export type AdminLikeRow = {
  name: string;
  likes: number;
};

export type AdminRatingRow = {
  name: string;
  average: number;
  count: number;
};

export type AdminSnapshot = {
  namePool: { borg: number; mio: number; ai: number; total: number };
  catalog: ReturnType<typeof getCatalogCounts>;
  community: {
    totalLikes: number;
    likedNames: number;
    ratedNames: number;
    likes: AdminLikeRow[];
    ratings: AdminRatingRow[];
  };
  localUserBuckets: number;
  supabaseConfigured: boolean;
  profiles: AdminProfile[];
  profileError: string | null;
  profileAccessHint: string | null;
  rolls: AdminRoll[];
  rollsError: string | null;
  aiGenerations: {
    total: number;
  };
};

export type SignupBucket = {
  label: string;
  count: number;
  dayKey: string;
};

export type ChartDayBucket = SignupBucket;

export const SIGNUP_CHART_DAYS = 7;

function getWeekdayShortLabel(date: Date) {
  return date.toLocaleDateString(undefined, { weekday: "short" });
}

function getDailyBuckets(
  items: Array<{ timestamp: string }>,
  days = SIGNUP_CHART_DAYS,
): ChartDayBucket[] {
  return getSignupWindowDays(days).map((date) => ({
    label: getWeekdayShortLabel(date),
    count: items.filter((item) => isItemOnLocalDay(item.timestamp, date)).length,
    dayKey: getLocalDayKey(date),
  }));
}

function parseTimestamp(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseMemberSince(memberSince: string) {
  return parseTimestamp(memberSince);
}

function getLocalDayStart(date = new Date()) {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day;
}

function getLocalDayKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getSignupWindowDays(days = SIGNUP_CHART_DAYS) {
  const windowDays: Date[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = getLocalDayStart();
    date.setDate(date.getDate() - i);
    windowDays.push(date);
  }

  return windowDays;
}

function isItemOnLocalDay(timestamp: string, dayStart: Date) {
  const parsed = parseTimestamp(timestamp);
  if (!parsed) return false;

  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  return parsed >= dayStart && parsed < dayEnd;
}

function isProfileOnLocalDay(profile: AdminProfile, dayStart: Date) {
  return isItemOnLocalDay(profile.member_since, dayStart);
}

export function isProfileInSignupWindow(
  profile: AdminProfile,
  days = SIGNUP_CHART_DAYS,
) {
  return getSignupWindowDays(days).some((dayStart) =>
    isProfileOnLocalDay(profile, dayStart),
  );
}

export function getRecentMemberProfiles(profiles: AdminProfile[]) {
  return [...profiles].sort(
    (a, b) =>
      (parseMemberSince(b.member_since)?.getTime() ?? 0) -
      (parseMemberSince(a.member_since)?.getTime() ?? 0),
  );
}

export function formatMemberSince(memberSince: string) {
  const joined = parseMemberSince(memberSince);
  if (!joined) return "Unknown";
  return joined.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatCompactRollCount(value: number) {
  if (value < 1000) return value.toLocaleString();

  const tiers = [
    { divisor: 1_000_000_000, suffix: "B" },
    { divisor: 1_000_000, suffix: "M" },
    { divisor: 1_000, suffix: "K" },
  ] as const;

  for (const { divisor, suffix } of tiers) {
    if (value >= divisor) {
      const scaled = Math.floor((value / divisor) * 10) / 10;
      const [whole, decimal = "0"] = scaled.toString().split(".");
      return `${whole}${suffix}.${decimal.charAt(0)}+`;
    }
  }

  return value.toLocaleString();
}

export function getProfileSignupBuckets(
  profiles: AdminProfile[],
  days = SIGNUP_CHART_DAYS
): ChartDayBucket[] {
  return getDailyBuckets(
    profiles.map((profile) => ({ timestamp: profile.member_since })),
    days,
  );
}

export function getGenerationBuckets(
  rolls: AdminRoll[],
  days = SIGNUP_CHART_DAYS,
): ChartDayBucket[] {
  return getDailyBuckets(
    rolls.map((roll) => ({ timestamp: roll.rolled_at })),
    days,
  );
}

export function getRecentRolls(rolls: AdminRoll[]) {
  return [...rolls].sort(
    (a, b) =>
      (parseTimestamp(b.rolled_at)?.getTime() ?? 0) -
      (parseTimestamp(a.rolled_at)?.getTime() ?? 0),
  );
}

export function formatRolledAt(rolledAt: string) {
  const rolled = parseTimestamp(rolledAt);
  if (!rolled) return "Unknown";
  return rolled.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function maxSignupBucketCount(buckets: ChartDayBucket[]) {
  return Math.max(1, ...buckets.map((bucket) => bucket.count));
}

const LOCAL_ROLLS_PREFIX = "borgwithus-recent-rolls:";

function loadAllLocalRolls(): AdminRoll[] {
  const rolls: AdminRoll[] = [];
  const seen = new Set<string>();

  const addRoll = (roll: RecentRoll) => {
    if (seen.has(roll.id)) return;
    seen.add(roll.id);
    rolls.push({
      id: roll.id,
      name: roll.name,
      roll_type: roll.type,
      rolled_at: roll.rolledAt,
    });
  };

  try {
    const legacyRaw = localStorage.getItem("borgwithus-recent-rolls");
    if (legacyRaw) {
      for (const roll of JSON.parse(legacyRaw) as RecentRoll[]) addRoll(roll);
    }
  } catch {
    // ignore malformed cache
  }

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(LOCAL_ROLLS_PREFIX)) continue;

    try {
      const items = JSON.parse(localStorage.getItem(key) ?? "[]") as RecentRoll[];
      for (const roll of items) addRoll(roll);
    } catch {
      // ignore malformed cache
    }
  }

  return rolls;
}

export async function fetchAdminRolls(): Promise<{
  rolls: AdminRoll[];
  error: string | null;
}> {
  const localRolls = loadAllLocalRolls();

  if (!isSupabaseConfigured) {
    return { rolls: localRolls, error: null };
  }

  try {
    const supabase = getSupabase();

    const rpc = await supabase.rpc("admin_list_rolls");
    if (!rpc.error && Array.isArray(rpc.data)) {
      const rolls = (rpc.data as AdminRoll[]).map((roll) => ({
        id: roll.id,
        name: roll.name,
        roll_type: roll.roll_type,
        rolled_at: roll.rolled_at,
      }));
      if (rolls.length > 0) {
        return { rolls, error: null };
      }
    }

    const { data, error } = await supabase
      .from("user_rolls")
      .select("id, name, roll_type, rolled_at")
      .order("rolled_at", { ascending: false })
      .range(0, 9999);

    if (error) {
      if (localRolls.length > 0) {
        return { rolls: localRolls, error: null };
      }
      const rpcHint = rpc.error
        ? ` Admin rolls RPC also failed: ${rpc.error.message}`
        : "";
      return { rolls: [], error: `${error.message}${rpcHint}` };
    }

    const rolls = (data ?? []) as AdminRoll[];
    if (rolls.length > 0) {
      return { rolls, error: null };
    }

    return { rolls: localRolls, error: null };
  } catch {
    return {
      rolls: localRolls,
      error: localRolls.length > 0 ? null : "Could not load generator rolls.",
    };
  }
}

function loadLikes(): Record<string, number> {
  try {
    const raw =
      localStorage.getItem(LIKES_KEY) ?? localStorage.getItem(LEGACY_PICKS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, number>;
  } catch {
    return {};
  }
}

function loadRatings(): Record<string, { total: number; count: number }> {
  try {
    const raw = localStorage.getItem(RATINGS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, { total: number; count: number }>;
  } catch {
    return {};
  }
}

function countLocalUserBuckets() {
  const ids = new Set<string>();

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;

    for (const prefix of USER_KEY_PREFIXES) {
      if (key.startsWith(prefix)) {
        ids.add(key.slice(prefix.length));
      }
    }
  }

  return ids.size;
}

export function buildAdminSnapshot(): Omit<
  AdminSnapshot,
  "profiles" | "profileError" | "profileAccessHint" | "rolls" | "rollsError"
> {
  const likes = loadLikes();
  const ratings = loadRatings();

  const likeRows = Object.entries(likes)
    .map(([name, count]) => ({ name, likes: count }))
    .sort((a, b) => b.likes - a.likes);

  const ratingRows = Object.entries(ratings)
    .map(([name, { total, count }]) => ({
      name,
      average: count ? total / count : 0,
      count,
    }))
    .sort((a, b) => b.average - a.average);

  const catalog = getCatalogCounts();

  return {
    namePool: {
      borg: catalog.borg,
      mio: catalog.mio,
      ai: catalog.ai,
      total: catalog.total,
    },
    catalog,
    community: {
      totalLikes: likeRows.reduce((sum, row) => sum + row.likes, 0),
      likedNames: likeRows.length,
      ratedNames: ratingRows.length,
      likes: likeRows,
      ratings: ratingRows,
    },
    localUserBuckets: countLocalUserBuckets(),
    supabaseConfigured: isSupabaseConfigured,
    aiGenerations: { total: 0 },
  };
}

export async function fetchAdminProfiles(): Promise<{
  profiles: AdminProfile[];
  error: string | null;
  accessHint: string | null;
}> {
  if (!isSupabaseConfigured) {
    return { profiles: [], error: null, accessHint: null };
  }

  try {
    const supabase = getSupabase();

    const rpc = await supabase.rpc("admin_list_profiles");
    if (!rpc.error && Array.isArray(rpc.data) && rpc.data.length > 0) {
      return {
        profiles: rpc.data as AdminProfile[],
        error: null,
        accessHint: null,
      };
    }

    const rpcUnavailable =
      rpc.error?.code === "PGRST202" ||
      /admin_list_profiles/i.test(rpc.error?.message ?? "");

    const { data, error } = await supabase
      .from("profiles")
      .select("id, member_since")
      .order("member_since", { ascending: false })
      .range(0, 9999);

    if (error) {
      const rpcHint = rpc.error
        ? ` Admin profile RPC also failed: ${rpc.error.message}`
        : "";
      return {
        profiles: [],
        error: `${error.message}${rpcHint}`,
        accessHint: null,
      };
    }

    const profiles = (data ?? []) as AdminProfile[];
    const accessHint =
      profiles.length === 1 && (rpcUnavailable || Boolean(rpc.error))
        ? "Only your own profile is visible. Run supabase/admin-profiles-access.sql in the Supabase SQL editor to load all users."
        : null;

    return { profiles, error: null, accessHint };
  } catch {
    return {
      profiles: [],
      error: "Could not load profiles.",
      accessHint: null,
    };
  }
}

export async function loadAdminSnapshot(options?: {
  hydrate?: boolean;
}): Promise<AdminSnapshot> {
  if (options?.hydrate) {
    await hydrateSharedBorgData({ force: true });
  }

  const base = buildAdminSnapshot();
  const [
    { profiles, error, accessHint },
    { rolls, error: rollsError },
    remoteCommunity,
    aiGenerations,
  ] = await Promise.all([
    fetchAdminProfiles(),
    fetchAdminRolls(),
    fetchCommunityStatsFromSupabase(),
    fetchAdminAiGenerations(),
  ]);

  const community = remoteCommunity
    ? {
        totalLikes: remoteCommunity.likes.reduce((sum, row) => sum + row.likes, 0),
        likedNames: remoteCommunity.likes.length,
        ratedNames: remoteCommunity.ratings.length,
        likes: remoteCommunity.likes,
        ratings: remoteCommunity.ratings,
      }
    : base.community;

  setCommunitySyncRemote(Boolean(remoteCommunity));

  return {
    ...base,
    community,
    profiles,
    profileError: error,
    profileAccessHint: accessHint,
    rolls,
    rollsError,
    aiGenerations: {
      total: aiGenerations.rows.length,
    },
  };
}

export function resetCommunityLeaderboard() {
  localStorage.removeItem(LIKES_KEY);
  localStorage.removeItem(LEGACY_PICKS_KEY);
  localStorage.removeItem(RATINGS_KEY);
  window.dispatchEvent(new Event("leaderboard:update"));
}
