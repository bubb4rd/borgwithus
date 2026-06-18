import { getSupabase, isSupabaseConfigured } from "./supabase";
import type { RecentRoll, RollType, SavedLike } from "./userData";

export async function fetchUserDataFromSupabase(userId: string): Promise<{
  likes: SavedLike[];
  rolls: RecentRoll[];
} | null> {
  if (!isSupabaseConfigured) return null;

  try {
    const supabase = getSupabase();
    const [likesRes, rollsRes] = await Promise.all([
      supabase
        .from("user_saved_likes")
        .select("id, name, liked_at, rating")
        .eq("user_id", userId)
        .order("liked_at", { ascending: false }),
      supabase
        .from("user_rolls")
        .select("id, name, roll_type, rolled_at")
        .eq("user_id", userId)
        .order("rolled_at", { ascending: false })
        .limit(100),
    ]);

    if (likesRes.error || rollsRes.error) return null;

    return {
      likes: (likesRes.data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        likedAt: row.liked_at,
        rating: row.rating ?? undefined,
      })),
      rolls: (rollsRes.data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        type: row.roll_type as RollType,
        rolledAt: row.rolled_at,
      })),
    };
  } catch {
    return null;
  }
}

export async function pushUserDataToSupabase(
  userId: string,
  likes: SavedLike[],
  rolls: RecentRoll[]
) {
  if (!isSupabaseConfigured) return;

  try {
    const supabase = getSupabase();

    if (likes.length > 0) {
      await supabase.from("user_saved_likes").upsert(
        likes.map((like) => ({
          id: like.id,
          user_id: userId,
          name: like.name,
          liked_at: like.likedAt,
          rating: like.rating ?? null,
        })),
        { onConflict: "user_id,name" }
      );
    }

    if (rolls.length > 0) {
      await supabase.from("user_rolls").upsert(
        rolls.map((roll) => ({
          id: roll.id,
          user_id: userId,
          name: roll.name,
          roll_type: roll.type,
          rolled_at: roll.rolledAt,
        })),
        { onConflict: "id" }
      );
    }
  } catch {
    // Keep local cache if remote sync fails.
  }
}

export async function syncSavedLikeToSupabase(userId: string, like: SavedLike) {
  if (!isSupabaseConfigured) return;

  try {
    const supabase = getSupabase();
    await supabase.from("user_saved_likes").upsert(
      {
        id: like.id,
        user_id: userId,
        name: like.name,
        liked_at: like.likedAt,
        rating: like.rating ?? null,
      },
      { onConflict: "user_id,name" }
    );
  } catch {
    // ignore
  }
}

export async function deleteSavedLikeFromSupabase(id: string) {
  if (!isSupabaseConfigured) return;

  try {
    await getSupabase().from("user_saved_likes").delete().eq("id", id);
  } catch {
    // ignore
  }
}

export async function syncRollToSupabase(userId: string, roll: RecentRoll) {
  if (!isSupabaseConfigured) return;

  try {
    const supabase = getSupabase();
    await supabase.from("user_rolls").upsert(
      {
        id: roll.id,
        user_id: userId,
        name: roll.name,
        roll_type: roll.type,
        rolled_at: roll.rolledAt,
      },
      { onConflict: "id" }
    );
  } catch {
    // ignore
  }
}
