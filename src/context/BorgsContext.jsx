import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import data from "../data.json";
import { supabase } from "../lib/supabase";

// Every borg on the board, from public.borgs (supabase/migrations/20261018000000_borg_catalog.sql),
// which admins manage from the dashboard's Borgs tab. The generator rolls from it, the marquee shows
// the featured names and BORG AI avoids them all.
// The classics bundled in data.json stand in until the table answers, and for good when Supabase
// isn't configured or can't be reached.
const BUNDLED = data.borgs.map((name) => ({
  name,
  original: null,
  source: "classic",
  featured: data.featured.includes(name),
}));

const BorgsContext = createContext(null);

export function BorgsProvider({ children }) {
  const [state, setState] = useState({ status: supabase ? "loading" : "offline", rows: BUNDLED, error: null });
  const latest = useRef(0);

  const reload = useCallback(async () => {
    if (!supabase) return;
    const id = ++latest.current;
    const { data: rows, error } = await supabase
      .from("borgs")
      .select("name, original, source, featured")
      .order("id");
    // A newer reload supersedes this one.
    if (id !== latest.current) return;
    setState((current) =>
      error
        ? { ...current, status: "error", error: error.message || "Request failed" }
        : { status: "ready", rows, error: null }
    );
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const value = useMemo(() => {
    const names = state.rows.map((row) => row.name);
    return {
      ...state,
      names,
      featured: state.rows.filter((row) => row.featured).map((row) => row.name),
      // Classics first: the edge functions keep only the first 300, and member and AI names reach
      // BORG AI from the database anyway (get_borg_ai_context()).
      avoid: [
        ...state.rows.filter((row) => row.source === "classic").map((row) => row.name),
        ...state.rows.filter((row) => row.source !== "classic").map((row) => row.name),
      ],
      reload,
    };
  }, [state, reload]);

  return <BorgsContext.Provider value={value}>{children}</BorgsContext.Provider>;
}

export function useBorgs() {
  return useContext(BorgsContext);
}
