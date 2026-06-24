import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  authErrorMessage,
  fetchProfileForUser,
  updateProfile,
  userFromAuth,
} from "../lib/profile";
import { isAdminEmail } from "../lib/adminAccess";
import { getSupabase, isSupabaseConfigured } from "../lib/supabase";
import { setPendingEmailVerification } from "../lib/pendingVerification";
import { hydrateUserDataFromSupabase } from "../lib/userData";
import { hydrateSharedBorgData } from "../lib/sharedBorgData";
import { bindUserStorage } from "../lib/userStorage";

export type AiTone = "funny" | "clean";

export type UserSettings = {
  emailNotifications: boolean;
  aiTone: AiTone;
};

export type User = {
  id: string;
  name: string;
  email: string;
  memberSince: string;
  isAdmin: boolean;
  settings: UserSettings;
};

export type SignupResult =
  | { status: "session" }
  | { status: "email_confirmation"; email: string };

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  isConfigured: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (
    name: string,
    email: string,
    password: string
  ) => Promise<SignupResult>;
  logout: () => Promise<void>;
  updateUser: (patch: Partial<Pick<User, "name" | "settings">>) => Promise<void>;
};

const MOCK_STORAGE_KEY = "borgwithus-user";

const DEFAULT_SETTINGS: UserSettings = {
  emailNotifications: false,
  aiTone: "funny",
};

const AuthContext = createContext<AuthContextValue | null>(null);

function normalizeUser(raw: User): User {
  return {
    ...raw,
    isAdmin: raw.isAdmin ?? isAdminEmail(raw.email),
    settings: { ...DEFAULT_SETTINGS, ...raw.settings },
  };
}

function loadMockUser(): User | null {
  try {
    const raw = localStorage.getItem(MOCK_STORAGE_KEY);
    if (!raw) return null;
    const user = normalizeUser(JSON.parse(raw) as User);
    return user.id ? user : { ...user, id: user.email };
  } catch {
    return null;
  }
}

function saveMockUser(user: User | null) {
  if (user) localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(user));
  else localStorage.removeItem(MOCK_STORAGE_KEY);
}

async function applyAuthUser(
  setUser: (user: User | null) => void,
  next: User | null
) {
  bindUserStorage(next?.id ?? null);
  setUser(next);

  if (next?.id && isSupabaseConfigured) {
    await hydrateUserDataFromSupabase(next.id);
  }
}

async function resolveAuthUser(
  authUser: Parameters<typeof fetchProfileForUser>[0]
) {
  try {
    return await fetchProfileForUser(authUser);
  } catch {
    return userFromAuth(authUser);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    void hydrateSharedBorgData();
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      void applyAuthUser(setUser, loadMockUser());
      setLoading(false);
      return;
    }

    const supabase = getSupabase();
    let active = true;

    const syncSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;

      const authUser = data.session?.user;
      if (!authUser) {
        void applyAuthUser(setUser, null);
        setLoading(false);
        return;
      }

      const profile = await resolveAuthUser(authUser);
      if (active) await applyAuthUser(setUser, profile);
      if (active) setLoading(false);
    };

    void syncSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;

      if (!session?.user) {
        void applyAuthUser(setUser, null);
        setLoading(false);
        return;
      }

      setLoading(true);
      void resolveAuthUser(session.user)
        .then(async (profile) => {
          if (active) await applyAuthUser(setUser, profile);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    if (!isSupabaseConfigured) {
      const existing = loadMockUser();
      if (existing?.email === email) {
        await applyAuthUser(setUser, existing);
        return;
      }

      const local = email.split("@")[0] || "Borger";
      const next: User = {
        id: email,
        name: local.charAt(0).toUpperCase() + local.slice(1),
        email,
        memberSince: new Date().toISOString(),
        isAdmin: isAdminEmail(email),
        settings: DEFAULT_SETTINGS,
      };
      saveMockUser(next);
      await applyAuthUser(setUser, next);
      return;
    }

    const supabase = getSupabase();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw new Error(authErrorMessage(error));

    const profile = await resolveAuthUser(data.user);
    await applyAuthUser(setUser, profile);
  }, []);

  const signup = useCallback(
    async (name: string, email: string, password: string): Promise<SignupResult> => {
      if (!isSupabaseConfigured) {
        const next: User = {
          id: email,
          name,
          email,
          memberSince: new Date().toISOString(),
          isAdmin: isAdminEmail(email),
          settings: DEFAULT_SETTINGS,
        };
        saveMockUser(next);
        await applyAuthUser(setUser, next);
        return { status: "session" };
      }

      const supabase = getSupabase();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
      });
      if (error) throw new Error(authErrorMessage(error));
      if (!data.user) throw new Error("Sign up failed. Please try again.");

      if (!data.session) {
        setPendingEmailVerification(email);
        return { status: "email_confirmation", email };
      }

      const profile = await resolveAuthUser(data.user);
      await applyAuthUser(setUser, profile);
      return { status: "session" };
    },
    []
  );

  const logout = useCallback(async () => {
    if (!isSupabaseConfigured) {
      saveMockUser(null);
      await applyAuthUser(setUser, null);
      return;
    }

    const supabase = getSupabase();
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(authErrorMessage(error));
    await applyAuthUser(setUser, null);
  }, []);

  const updateUser = useCallback(
    async (patch: Partial<Pick<User, "name" | "settings">>) => {
      if (!user) return;

      const next = normalizeUser({
        ...user,
        ...patch,
        settings: patch.settings
          ? { ...user.settings, ...patch.settings }
          : user.settings,
      });

      if (!isSupabaseConfigured) {
        saveMockUser(next);
        setUser(next);
        return;
      }

      const supabase = getSupabase();
      const { data } = await supabase.auth.getUser();
      const authUser = data.user;
      if (!authUser) throw new Error("You are not logged in.");

      await updateProfile(authUser.id, patch);
      setUser(next);
    },
    [user]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isConfigured: isSupabaseConfigured,
        login,
        signup,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
