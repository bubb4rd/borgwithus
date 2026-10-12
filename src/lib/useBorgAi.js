import { useCallback, useEffect, useState } from "react";
import { useBorgs } from "../context/BorgsContext";
import { experimentTags } from "./generatorExperiment";
import { supabase } from "./supabase";

// One member's BORG AI: today's credits and a generate() that spends one through the
// generate-borg-name edge function. Shared by the BORG AI card and the jug configurator.
export default function useBorgAi(userId) {
  const { avoid } = useBorgs();
  const [result, setResult] = useState(null);
  const [credits, setCredits] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!supabase || !userId) return undefined;
    let active = true;
    supabase.rpc("get_ai_credits").then(({ data: next }) => {
      if (active && next) setCredits(next);
    });
    return () => {
      active = false;
    };
  }, [userId]);

  const outOfCredits = credits?.remaining === 0;

  // Resolves to the new name, or null when there isn't one (the reason is in `error`).
  const generate = useCallback(
    async (theme) => {
      if (loading || outOfCredits) return null;
      setLoading(true);
      setError(null);

      const { data: payload, error: invokeError } = await supabase.functions.invoke(
        "generate-borg-name",
        { body: { prompt: theme.trim(), avoid, ...experimentTags() } }
      );

      // Non-2xx responses still carry { error, remaining } in the body.
      const body = invokeError ? await invokeError.context?.json?.().catch(() => null) : payload;

      if (typeof body?.remaining === "number") {
        setCredits((current) => current && { ...current, remaining: body.remaining });
      }
      const name = body?.name ?? null;
      if (name) setResult(name);
      else setError(body?.error ?? "BORG AI couldn't be reached. Try again.");
      setLoading(false);
      return name;
    },
    [avoid, loading, outOfCredits]
  );

  return { result, credits, outOfCredits, loading, error, generate };
}
