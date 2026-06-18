import type { User as SupabaseUser } from "@supabase/supabase-js";
import type { User, UserSettings } from "../context/AuthContext";
import { isAdminEmail } from "./adminAccess";
import { getSupabase } from "./supabase";

export type ProfileRow = {
  id: string;
  name: string;
  member_since: string;
  is_admin?: boolean;
  settings: UserSettings;
};

const DEFAULT_SETTINGS: UserSettings = {
  emailNotifications: false,
  aiTone: "funny",
};

const PROFILE_COLUMNS = "id, name, member_since, is_admin, settings";
const LEGACY_PROFILE_COLUMNS = "id, name, member_since, settings";

export function normalizeSettings(raw: Partial<UserSettings> | null | undefined): UserSettings {
  return { ...DEFAULT_SETTINGS, ...raw };
}

function displayNameFromAuth(authUser: SupabaseUser): string {
  const metaName = authUser.user_metadata?.name;
  if (typeof metaName === "string" && metaName.trim()) return metaName.trim();

  const local = authUser.email?.split("@")[0] || "Borger";
  return local.charAt(0).toUpperCase() + local.slice(1);
}

export function userFromAuth(authUser: SupabaseUser): User {
  const email = authUser.email ?? "";
  return {
    id: authUser.id,
    name: displayNameFromAuth(authUser),
    email,
    memberSince: authUser.created_at,
    isAdmin: isAdminEmail(email),
    settings: normalizeSettings(authUser.user_metadata?.settings),
  };
}

export function userFromProfile(
  authUser: SupabaseUser,
  profile: ProfileRow
): User {
  const email = authUser.email ?? "";
  return {
    id: authUser.id,
    name: profile.name,
    email,
    memberSince: profile.member_since,
    isAdmin: profile.is_admin ?? isAdminEmail(email),
    settings: normalizeSettings(profile.settings),
  };
}

function isMissingAdminColumn(error: { message?: string } | null) {
  const message = error?.message ?? "";
  return /is_admin/i.test(message) && /column|schema cache/i.test(message);
}

async function loadProfileRow(authUser: SupabaseUser) {
  const supabase = getSupabase();

  const primary = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", authUser.id)
    .maybeSingle();

  if (!primary.error) {
    return { data: primary.data as ProfileRow | null, error: null };
  }

  if (!isMissingAdminColumn(primary.error)) {
    return { data: null, error: primary.error };
  }

  const legacy = await supabase
    .from("profiles")
    .select(LEGACY_PROFILE_COLUMNS)
    .eq("id", authUser.id)
    .maybeSingle();

  return {
    data: legacy.data as ProfileRow | null,
    error: legacy.error,
  };
}

async function ensureProfileRow(authUser: SupabaseUser, fallback: User) {
  const supabase = getSupabase();
  const baseRow = {
    id: authUser.id,
    name: fallback.name,
    member_since: fallback.memberSince,
    settings: fallback.settings,
  };

  const withAdmin = { ...baseRow, is_admin: fallback.isAdmin };
  const inserted = await supabase.from("profiles").insert(withAdmin);
  if (!inserted.error) return;

  if (isMissingAdminColumn(inserted.error)) {
    const legacyInsert = await supabase.from("profiles").insert(baseRow);
    if (legacyInsert.error) throw legacyInsert.error;
    return;
  }

  throw inserted.error;
}

export async function fetchProfileForUser(authUser: SupabaseUser): Promise<User> {
  const fallback = userFromAuth(authUser);
  const { data, error } = await loadProfileRow(authUser);

  if (error) throw error;
  if (data) return userFromProfile(authUser, data);

  await ensureProfileRow(authUser, fallback);
  return fallback;
}

export async function updateProfile(
  userId: string,
  patch: Partial<Pick<User, "name" | "settings">>
) {
  const supabase = getSupabase();
  const updates: Partial<ProfileRow> = {};

  if (patch.name !== undefined) updates.name = patch.name;
  if (patch.settings !== undefined) updates.settings = patch.settings;

  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId);

  if (error) throw error;
}

export function authErrorMessage(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String((error as { message: unknown }).message)
        : "Something went wrong. Please try again.";

  if (/invalid login credentials/i.test(message)) {
    return "Invalid email or password.";
  }
  if (/user already registered/i.test(message)) {
    return "An account with this email already exists.";
  }
  if (/email not confirmed/i.test(message)) {
    return "Check your inbox to confirm your email before logging in.";
  }
  if (/password should be at least/i.test(message)) {
    return "Password must be at least 8 characters.";
  }
  if (/infinite recursion/i.test(message)) {
    return "Account setup error. Run supabase/fix-login.sql in your Supabase project.";
  }

  return message;
}
