import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";

// 👎 on BORG AI names: the AI Borg Studio shows them, and names with as many dislikes as likes
// never become prompt examples. A name is liked or disliked, not both: liking clears the dislike
// (LikesContext), disliking clears the like (DislikeButton).
const DislikesContext = createContext(null);

export function DislikesProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [disliked, setDisliked] = useState(() => new Set());

  useEffect(() => {
    setDisliked(new Set());
    if (!supabase || !userId) return undefined;

    let active = true;
    supabase
      .from("borg_ai_dislikes")
      .select("name")
      .then(({ data }) => {
        if (active && data) setDisliked(new Set(data.map((row) => row.name)));
      });
    return () => {
      active = false;
    };
  }, [userId]);

  const setDislike = useCallback(
    async (name, dislikeIt) => {
      if (!supabase || !userId || disliked.has(name) === dislikeIt) return;

      const flip = (on) =>
        setDisliked((current) => {
          const next = new Set(current);
          if (on) next.add(name);
          else next.delete(name);
          return next;
        });

      flip(dislikeIt);
      const { error } = dislikeIt
        ? await supabase.from("borg_ai_dislikes").insert({ user_id: userId, name })
        : await supabase.from("borg_ai_dislikes").delete().eq("user_id", userId).eq("name", name);

      // 23505: the dislike already exists (another tab got there first), so it is disliked either way.
      if (error && error.code !== "23505") flip(!dislikeIt);
    },
    [disliked, userId]
  );

  const clearDislike = useCallback((name) => setDislike(name, false), [setDislike]);

  const value = useMemo(
    () => ({ disliked, setDislike, clearDislike }),
    [disliked, setDislike, clearDislike]
  );

  return <DislikesContext.Provider value={value}>{children}</DislikesContext.Provider>;
}

export function useDislikes() {
  return useContext(DislikesContext);
}
