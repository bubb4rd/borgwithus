import { getSupabase, isSupabaseConfigured } from "./supabase";
import type { AdminLikeRow, AdminRatingRow } from "./adminStats";

export async function syncLikeToSupabase(name: string) {
  if (!isSupabaseConfigured) return;

  try {
    const supabase = getSupabase();
    const { data } = await supabase
      .from("borg_name_stats")
      .select("like_count")
      .eq("name", name)
      .maybeSingle();

    if (data) {
      await supabase
        .from("borg_name_stats")
        .update({ like_count: data.like_count + 1 })
        .eq("name", name);
    } else {
      await supabase.from("borg_name_stats").insert({ name, like_count: 1 });
    }
  } catch {
    // ignore
  }
}

export async function syncRatingToSupabase(name: string, stars: number) {
  if (!isSupabaseConfigured) return;

  try {
    const supabase = getSupabase();
    const { data } = await supabase
      .from("borg_name_stats")
      .select("rating_total, rating_count")
      .eq("name", name)
      .maybeSingle();

    if (data) {
      await supabase
        .from("borg_name_stats")
        .update({
          rating_total: Number(data.rating_total) + stars,
          rating_count: data.rating_count + 1,
        })
        .eq("name", name);
    } else {
      await supabase.from("borg_name_stats").insert({
        name,
        rating_total: stars,
        rating_count: 1,
      });
    }
  } catch {
    // ignore
  }
}

export async function fetchCommunityStatsFromSupabase(): Promise<{
  likes: AdminLikeRow[];
  ratings: AdminRatingRow[];
} | null> {
  if (!isSupabaseConfigured) return null;

  try {
    const { data, error } = await getSupabase()
      .from("borg_name_stats")
      .select("name, like_count, rating_total, rating_count")
      .order("like_count", { ascending: false });

    if (error || !data?.length) return null;

    const likes = data
      .filter((row) => row.like_count > 0)
      .map((row) => ({ name: row.name, likes: row.like_count }));

    const ratings = data
      .filter((row) => row.rating_count > 0)
      .map((row) => ({
        name: row.name,
        average: Number(row.rating_total) / row.rating_count,
        count: row.rating_count,
      }))
      .sort((a, b) => b.average - a.average);

    return { likes, ratings };
  } catch {
    return null;
  }
}

export async function fetchLikesLeaderboardFromSupabase(
  limit: number
): Promise<{ name: string; value: number }[] | null> {
  if (!isSupabaseConfigured) return null;

  try {
    const { data, error } = await getSupabase()
      .from("borg_name_stats")
      .select("name, like_count")
      .gt("like_count", 0)
      .order("like_count", { ascending: false })
      .limit(limit);

    if (error) return null;

    return (data ?? []).map((row) => ({
      name: row.name,
      value: row.like_count,
    }));
  } catch {
    return null;
  }
}

export async function fetchRatingsLeaderboardFromSupabase(
  limit: number
): Promise<{ name: string; value: number; detail: string }[] | null> {
  if (!isSupabaseConfigured) return null;

  try {
    const { data, error } = await getSupabase()
      .from("borg_name_stats")
      .select("name, rating_total, rating_count")
      .gt("rating_count", 0)
      .order("rating_total", { ascending: false })
      .limit(limit * 3);

    if (error) return null;

    return [...(data ?? [])]
      .map((row) => ({
        name: row.name,
        value: Number(row.rating_total) / row.rating_count,
        count: row.rating_count,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, limit)
      .map(({ name, value, count }) => ({
        name,
        value,
        detail: `${count} ratings`,
      }));
  } catch {
    return null;
  }
}
