import { createClient } from "@supabase/supabase-js";

const url = process.env.REACT_APP_SUPABASE_URL;
const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

// Email links come back with their result in the URL. Read it before the client takes the tokens
// out of the hash. A password-reset link opens /reset-password even when Supabase fell back to
// the site root (the path isn't on the project's redirect allowlist), and a failed link opens
// /login instead of the home page.
const linkParams = new URLSearchParams(`${window.location.search.slice(1)}&${window.location.hash.slice(1)}`);
if (linkParams.get("type") === "recovery" && window.location.pathname !== "/reset-password") {
  window.history.replaceState(null, "", `/reset-password${window.location.hash}`);
} else if (linkParams.has("error_description") && window.location.pathname === "/") {
  window.history.replaceState(null, "", `/login${window.location.search}${window.location.hash}`);
}

/** Why the email link that opened this page failed, null when it didn't (or there was none). */
export const authLinkError = linkParams.has("error_description")
  ? linkParams.get("error_code") === "otp_expired"
    ? "That email link expired or was already used."
    : linkParams.get("error_description")
  : null;

let client = null;
let checking = null;

// True when the auth server turned down the stored session (revoked, its user deleted, signed
// with an old key), which is then dropped from this browser. Concurrent callers share one check.
function dropRejectedSession() {
  checking ??= client.auth
    .getUser()
    .then(async ({ error }) => {
      if (error?.status !== 401 && error?.status !== 403) return false;
      await client.auth.signOut({ scope: "local" });
      return true;
    })
    .catch(() => false)
    .finally(() => {
      checking = null;
    });
  return checking;
}

// A stored session can look valid to the browser (not expired yet) while the server refuses it,
// and then every request fails with 401. On a 401 for a member's token, ask the auth server
// whether the session still stands; if it doesn't, sign out locally and send the request again
// as a guest, so the page loads and the UI shows the logged-out state.
async function sessionCheckingFetch(input, init = {}) {
  const response = await fetch(input, init);
  const target = String(input instanceof Request ? input.url : input);
  if (response.status !== 401 || target.includes("/auth/v1/")) return response;

  const headers = new Headers(init.headers);
  const bearer = headers.get("Authorization");
  if (!bearer || bearer === `Bearer ${anonKey}`) return response;
  if (!(await dropRejectedSession())) return response;

  headers.set("Authorization", `Bearer ${anonKey}`);
  return fetch(input, { ...init, headers });
}

// Null when the env vars are missing: accounts, BORG AI and the leaderboard render as offline.
if (url && anonKey) client = createClient(url, anonKey, { global: { fetch: sessionCheckingFetch } });

export const supabase = client;
