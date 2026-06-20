import { getSupabase, isSupabaseConfigured } from "./supabase";

export type CachedNameStats = {
  likeCount: number;
  ratingTotal: number;
  ratingCount: number;
};

let nameStatsCache: Map<string, CachedNameStats> | null = null;

export function hasNameStatsCache() {
  return nameStatsCache !== null;
}

export function getCachedNameStats(name: string): CachedNameStats | null {
  if (!nameStatsCache) return null;
  return nameStatsCache.get(name.trim().toLowerCase()) ?? null;
}

export function clearNameStatsCache() {
  nameStatsCache = null;
}

export async function hydrateNameStatsCache(): Promise<void> {
  if (!isSupabaseConfigured) {
    nameStatsCache = null;
    return;
  }

  try {
    const { data, error } = await getSupabase()
      .from("borg_name_stats")
      .select("name, like_count, rating_total, rating_count");

    if (error || !data) {
      nameStatsCache = null;
      return;
    }

    const next = new Map<string, CachedNameStats>();
    for (const row of data) {
      next.set(row.name.trim().toLowerCase(), {
        likeCount: row.like_count,
        ratingTotal: Number(row.rating_total),
        ratingCount: row.rating_count,
      });
    }
    nameStatsCache = next;
  } catch {
    nameStatsCache = null;
  }
}
