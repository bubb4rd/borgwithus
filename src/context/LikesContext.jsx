import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";

const LEADERBOARD_SIZE = 10;

const LikesContext = createContext(null);

export function LikesProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [liked, setLiked] = useState(() => new Set());
  const [leaderboard, setLeaderboard] = useState({
    status: supabase ? "loading" : "offline",
    rows: [],
  });

  const loadLeaderboard = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("borg_like_counts")
      .select("name, likes")
      .order("likes", { ascending: false })
      .order("name")
      .limit(LEADERBOARD_SIZE);
    setLeaderboard(error ? { status: "error", rows: [] } : { status: "ready", rows: data });
  }, []);

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  useEffect(() => {
    setLiked(new Set());
    if (!supabase || !userId) return undefined;

    let active = true;
    supabase
      .from("borg_likes")
      .select("name")
      .then(({ data }) => {
        if (active && data) setLiked(new Set(data.map((row) => row.name)));
      });
    return () => {
      active = false;
    };
  }, [userId]);

  const toggleLike = useCallback(
    async (name) => {
      if (!supabase || !userId) return;

      const wasLiked = liked.has(name);
      const flip = (likeIt) =>
        setLiked((current) => {
          const next = new Set(current);
          if (likeIt) next.add(name);
          else next.delete(name);
          return next;
        });

      flip(!wasLiked);
      const { error } = wasLiked
        ? await supabase.from("borg_likes").delete().eq("user_id", userId).eq("name", name)
        : await supabase.from("borg_likes").insert({ user_id: userId, name });

      // 23505: the like already exists (another tab got there first), so it is liked either way.
      if (error && error.code !== "23505") flip(wasLiked);
      loadLeaderboard();
    },
    [liked, userId, loadLeaderboard]
  );

  const value = useMemo(
    () => ({ liked, leaderboard, toggleLike }),
    [liked, leaderboard, toggleLike]
  );

  return <LikesContext.Provider value={value}>{children}</LikesContext.Provider>;
}

export function useLikes() {
  return useContext(LikesContext);
}
