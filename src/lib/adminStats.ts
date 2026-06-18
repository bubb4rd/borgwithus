import { getCatalogCounts } from "./borgCatalog";
import { fetchCommunityStatsFromSupabase } from "./leaderboardSupabase";
import { getSupabase, isSupabaseConfigured } from "./supabase";

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
};

export type SignupBucket = {
  label: string;
  count: number;
  dayKey: string;
};

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"] as const;

export const SIGNUP_CHART_DAYS = 7;

function parseMemberSince(memberSince: string) {
  const parsed = new Date(memberSince);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
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

function isProfileOnLocalDay(profile: AdminProfile, dayStart: Date) {
  const joined = parseMemberSince(profile.member_since);
  if (!joined) return false;

  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  return joined >= dayStart && joined < dayEnd;
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

export function getProfileSignupBuckets(
  profiles: AdminProfile[],
  days = SIGNUP_CHART_DAYS
): SignupBucket[] {
  return getSignupWindowDays(days).map((date) => ({
    label: WEEKDAY_LABELS[date.getDay()],
    count: profiles.filter((profile) => isProfileOnLocalDay(profile, date))
      .length,
    dayKey: getLocalDayKey(date),
  }));
}

export function maxSignupBucketCount(buckets: SignupBucket[]) {
  return Math.max(1, ...buckets.map((bucket) => bucket.count));
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
  "profiles" | "profileError" | "profileAccessHint"
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

export async function loadAdminSnapshot(): Promise<AdminSnapshot> {
  const base = buildAdminSnapshot();
  const [{ profiles, error, accessHint }, remoteCommunity] = await Promise.all([
    fetchAdminProfiles(),
    fetchCommunityStatsFromSupabase(),
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

  return {
    ...base,
    community,
    profiles,
    profileError: error,
    profileAccessHint: accessHint,
  };
}

export function resetCommunityLeaderboard() {
  localStorage.removeItem(LIKES_KEY);
  localStorage.removeItem(LEGACY_PICKS_KEY);
  localStorage.removeItem(RATINGS_KEY);
  window.dispatchEvent(new Event("leaderboard:update"));
}
