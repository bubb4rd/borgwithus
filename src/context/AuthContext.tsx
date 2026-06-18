import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type AiTone = "funny" | "clean";

export type UserSettings = {
  emailNotifications: boolean;
  aiTone: AiTone;
};

export type User = {
  name: string;
  email: string;
  memberSince: string;
  settings: UserSettings;
};

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (email: string) => void;
  signup: (name: string, email: string) => void;
  logout: () => void;
  updateUser: (patch: Partial<Pick<User, "name" | "settings">>) => void;
};

const STORAGE_KEY = "borgwithus-user";

const DEFAULT_SETTINGS: UserSettings = {
  emailNotifications: false,
  aiTone: "funny",
};

const AuthContext = createContext<AuthContextValue | null>(null);

function normalizeUser(raw: User): User {
  return {
    ...raw,
    settings: { ...DEFAULT_SETTINGS, ...raw.settings },
  };
}

function loadUser(): User | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalizeUser(JSON.parse(raw) as User);
  } catch {
    return null;
  }
}

function saveUser(user: User | null) {
  if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  else localStorage.removeItem(STORAGE_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUser(loadUser());
    setLoading(false);
  }, []);

  const login = useCallback((email: string) => {
    const existing = loadUser();
    if (existing?.email === email) {
      setUser(existing);
      return;
    }

    const local = email.split("@")[0] || "Borger";
    const next: User = {
      name: local.charAt(0).toUpperCase() + local.slice(1),
      email,
      memberSince: new Date().toISOString(),
      settings: DEFAULT_SETTINGS,
    };
    saveUser(next);
    setUser(next);
  }, []);

  const signup = useCallback((name: string, email: string) => {
    const next: User = {
      name,
      email,
      memberSince: new Date().toISOString(),
      settings: DEFAULT_SETTINGS,
    };
    saveUser(next);
    setUser(next);
  }, []);

  const logout = useCallback(() => {
    saveUser(null);
    setUser(null);
  }, []);

  const updateUser = useCallback(
    (patch: Partial<Pick<User, "name" | "settings">>) => {
      setUser((current) => {
        if (!current) return current;
        const next = normalizeUser({
          ...current,
          ...patch,
          settings: patch.settings
            ? { ...current.settings, ...patch.settings }
            : current.settings,
        });
        saveUser(next);
        return next;
      });
    },
    []
  );

  return (
    <AuthContext.Provider
      value={{ user, loading, login, signup, logout, updateUser }}
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
