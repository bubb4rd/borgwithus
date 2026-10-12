import { supabase } from "./supabase";

// The home page's generator A/B test (supabase/migrations/…_borg_generator_ab.sql).
// "classic": the BORG/MIO card next to the BORG AI card. "jug": the full-width jug configurator.
// Each browser is put in one group for good; `?gen=jug` or `?gen=classic` moves it (for QA).
export const GENERATOR_VARIANTS = ["classic", "jug"];

const VARIANT_KEY = "borg-generator-variant";
const VISITOR_KEY = "borg-visitor-id";

function storage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function randomId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

// A random id per browser, so guests' views and rolls can be matched up. Not tied to the account.
export function getVisitorId() {
  const store = storage();
  let id = store?.getItem(VISITOR_KEY);
  if (!id) {
    id = randomId();
    store?.setItem(VISITOR_KEY, id);
  }
  return id;
}

export function getGeneratorVariant() {
  const store = storage();
  const forced = new URLSearchParams(window.location.search).get("gen");
  if (GENERATOR_VARIANTS.includes(forced)) {
    store?.setItem(VARIANT_KEY, forced);
    return forced;
  }
  const saved = store?.getItem(VARIANT_KEY);
  if (GENERATOR_VARIANTS.includes(saved)) return saved;
  const picked = Math.random() < 0.5 ? "classic" : "jug";
  store?.setItem(VARIANT_KEY, picked);
  return picked;
}

// Counts a classic BORG or MIO roll for the dashboard and the A/B test. Fire and forget: stats
// never block the generator.
export function logRoll(kind, name) {
  supabase
    ?.rpc("log_borg_roll", {
      p_kind: kind,
      p_name: name,
      p_variant: getGeneratorVariant(),
      p_visitor: getVisitorId(),
    })
    .then(() => {});
}

// "view": the generator scrolled into sight (once per page load). "save"/"share": the jug image
// left the page. Fire and forget.
export function logGeneratorEvent(event) {
  supabase
    ?.rpc("log_generator_event", {
      p_event: event,
      p_variant: getGeneratorVariant(),
      p_visitor: getVisitorId(),
    })
    .then(() => {});
}

// What generate-borg-name needs to tag the AI roll it logs.
export function experimentTags() {
  return { variant: getGeneratorVariant(), visitor: getVisitorId() };
}
