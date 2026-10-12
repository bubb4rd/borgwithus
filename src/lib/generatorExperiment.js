import { supabase } from "./supabase";

// The home page's generator A/B test (supabase/migrations/…_borg_generator_ab.sql, readout in
// …_borg_generator_ab_readout.sql).
// "classic": the BORG/MIO card next to the BORG AI card. "jug": the full-width jug configurator.
// Each browser is put in one group for good. For QA, `?gen=jug` or `?gen=classic` moves the
// browser to that group and stops it counting toward the test (its rolls are still logged, just
// without a group); `?gen=off` clears both, and the browser gets a fresh random group.
export const GENERATOR_VARIANTS = ["classic", "jug"];

const VARIANT_KEY = "borg-generator-variant";
const VISITOR_KEY = "borg-visitor-id";
const QA_KEY = "borg-generator-qa";

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

// Applies `?gen=` once per page load.
let urlApplied = false;
function applyUrlOverride(store) {
  if (urlApplied) return;
  urlApplied = true;
  const forced = new URLSearchParams(window.location.search).get("gen");
  if (forced === "off") {
    store?.removeItem(VARIANT_KEY);
    store?.removeItem(QA_KEY);
  } else if (GENERATOR_VARIANTS.includes(forced)) {
    store?.setItem(VARIANT_KEY, forced);
    store?.setItem(QA_KEY, "1");
  }
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
  applyUrlOverride(store);
  const saved = store?.getItem(VARIANT_KEY);
  if (GENERATOR_VARIANTS.includes(saved)) return saved;
  const picked = Math.random() < 0.5 ? "classic" : "jug";
  store?.setItem(VARIANT_KEY, picked);
  return picked;
}

// True in a browser moved by `?gen=`: it shows its group but logs nothing for the test.
function isQa() {
  const store = storage();
  applyUrlOverride(store);
  return store?.getItem(QA_KEY) === "1";
}

// What a roll or BORG AI call is tagged with: the browser's group and visitor id, or nothing for
// a QA browser.
export function experimentTags() {
  if (isQa()) return { variant: null, visitor: null };
  return { variant: getGeneratorVariant(), visitor: getVisitorId() };
}

// Counts a classic BORG or MIO roll for the dashboard and the A/B test. Fire and forget: stats
// never block the generator.
export function logRoll(kind, name) {
  const { variant, visitor } = experimentTags();
  supabase
    ?.rpc("log_borg_roll", { p_kind: kind, p_name: name, p_variant: variant, p_visitor: visitor })
    .then(() => {});
}

// "view": the generator scrolled into sight (once per page load). "save"/"share": the jug image
// left the page. "signup_click": a Sign up link in the generator. "signup": an account was made
// in this browser. Fire and forget; QA browsers log nothing.
export function logGeneratorEvent(event) {
  const { variant, visitor } = experimentTags();
  if (!variant) return;
  supabase
    ?.rpc("log_generator_event", { p_event: event, p_variant: variant, p_visitor: visitor })
    .then(() => {});
}
