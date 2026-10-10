import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext(null);

const OFFLINE_MESSAGE = "Accounts are offline right now. Try again later.";

function friendlyAuthError(error) {
  const message = error?.message ?? "";
  if (/invalid login credentials/i.test(message)) return "That email and password don't match.";
  if (/already registered|already been registered/i.test(message)) {
    return "There's already an account with that email. Log in instead.";
  }
  if (/email not confirmed/i.test(message)) return "Confirm your email first, then log in.";
  if (/password should be at least/i.test(message)) return "Passwords need at least 8 characters.";
  if (/rate limit|too many/i.test(message)) return "Too many tries. Give it a minute.";
  return message || "Something went wrong. Try again.";
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(!supabase);
  // Whose admin check this is, so a stale answer never applies to the next member.
  const [adminCheck, setAdminCheck] = useState({ userId: null, isAdmin: false });
  const userId = session?.user?.id ?? null;

  useEffect(() => {
    if (!supabase) return undefined;

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase || !userId) return undefined;
    let active = true;
    supabase.rpc("is_borg_admin").then(({ data }) => {
      if (active) setAdminCheck({ userId, isAdmin: data === true });
    });
    return () => {
      active = false;
    };
  }, [userId]);

  const value = useMemo(() => {
    const user = session?.user ?? null;
    let isAdmin = false;
    // null while the check for this member is in flight.
    if (user) isAdmin = adminCheck.userId === user.id ? adminCheck.isAdmin : null;

    return {
      user,
      ready,
      online: Boolean(supabase),
      isAdmin,
      displayName: user ? user.user_metadata?.name || user.email.split("@")[0] : null,

      async logIn(email, password) {
        if (!supabase) throw new Error(OFFLINE_MESSAGE);
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error(friendlyAuthError(error));
      },

      // Resolves to true when the account still needs its email confirmed before logging in.
      async register(name, email, password) {
        if (!supabase) throw new Error(OFFLINE_MESSAGE);
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name }, emailRedirectTo: `${window.location.origin}/login` },
        });
        if (error) throw new Error(friendlyAuthError(error));
        return !data.session;
      },

      async logOut() {
        await supabase?.auth.signOut();
      },
    };
  }, [session, ready, adminCheck]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
