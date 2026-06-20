import { useState } from "react";
import AdminSignupLineChart from "./AdminSignupLineChart";
import SelectMenu from "./SelectMenu";
import {
  formatMemberSince,
  formatRolledAt,
  getGenerationBuckets,
  getProfileSignupBuckets,
  getRecentMemberProfiles,
  getRecentRolls,
  SIGNUP_CHART_DAYS,
  type AdminProfile,
  type AdminRoll,
} from "../lib/adminStats";
import { ROLL_LABELS } from "../lib/userData";

const METRICS_OPTIONS = [
  { value: "users" as const, label: "Registered users" },
  { value: "generations" as const, label: "Borgs generated" },
];

type MetricsView = (typeof METRICS_OPTIONS)[number]["value"];

const ROLL_BADGE_STYLES = {
  borg: "admin-kind-badge",
  mio: "admin-kind-badge",
  ai: "admin-kind-badge",
} as const;

export default function AdminUsersChart({
  profiles,
  rolls,
  profileError,
  rollsError,
}: {
  profiles: AdminProfile[];
  rolls: AdminRoll[];
  profileError?: string | null;
  rollsError?: string | null;
}) {
  const [view, setView] = useState<MetricsView>("users");

  const signupBuckets = getProfileSignupBuckets(profiles);
  const generationBuckets = getGenerationBuckets(rolls);
  const recentMembers = getRecentMemberProfiles(profiles);
  const recentRolls = getRecentRolls(rolls);

  const isUsersView = view === "users";
  const buckets = isUsersView ? signupBuckets : generationBuckets;
  const total = isUsersView ? profiles.length : rolls.length;
  const error = isUsersView ? profileError : rollsError;

  return (
    <section className="dashboard-panel admin-top-card flex flex-col">
      <div className="relative z-20 flex shrink-0 flex-wrap items-end justify-between gap-3 border-b border-[var(--dash-border)] px-4 py-3 sm:px-[1.2rem]">
        <div className="min-w-0 flex-1">
          <SelectMenu
            value={view}
            onChange={setView}
            options={METRICS_OPTIONS}
            ariaLabel="Admin metrics view"
          />
          <p className="mt-[0.2rem] text-xs text-[var(--dash-muted)] sm:text-sm">
            {isUsersView
              ? `Signups over the last ${SIGNUP_CHART_DAYS} days`
              : `Generations over the last ${SIGNUP_CHART_DAYS} days`}
          </p>
        </div>
        <p className="text-2xl font-bold tabular-nums leading-none text-[var(--dash-foreground)] sm:text-3xl">
          {total}
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 sm:p-[1.2rem]">
        {error ? (
          <p className="mb-2 shrink-0 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-xs text-amber-800 dark:text-amber-200">
            {error}
          </p>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row lg:items-stretch">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <AdminSignupLineChart
              buckets={buckets}
              metricKind={isUsersView ? "users" : "generations"}
            />
          </div>

          <div className="flex min-h-0 w-full flex-col lg:w-52 lg:shrink-0">
            <p className="mb-1 shrink-0 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-subtle">
              {isUsersView ? "Recent members" : "Recent generations"}
            </p>
            {isUsersView ? (
              recentMembers.length === 0 ? (
                <p className="text-xs text-subtle">No registered users yet.</p>
              ) : (
                <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-0.5">
                  {recentMembers.map((profile) => (
                    <li
                      key={profile.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-[var(--dash-border)] bg-elevated/40 px-2 py-1"
                    >
                      <span className="min-w-0 truncate font-mono text-[0.6rem] font-medium text-foreground sm:text-[0.65rem]">
                        {profile.id}
                      </span>
                      <span className="shrink-0 text-[0.65rem] text-subtle">
                        {formatMemberSince(profile.member_since)}
                      </span>
                    </li>
                  ))}
                </ul>
              )
            ) : recentRolls.length === 0 ? (
              <p className="text-xs text-subtle">No borgs generated yet.</p>
            ) : (
              <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-0.5">
                {recentRolls.map((roll) => (
                  <li
                    key={roll.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-[var(--dash-border)] bg-elevated/40 px-2 py-1"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-foreground">
                        {roll.name}
                      </p>
                      <span
                        className={`mt-0.5 inline-flex rounded-full px-1.5 py-0.5 text-[0.6rem] font-semibold ${ROLL_BADGE_STYLES[roll.roll_type]}`}
                      >
                        {ROLL_LABELS[roll.roll_type]}
                      </span>
                    </div>
                    <span className="shrink-0 text-[0.65rem] text-subtle">
                      {formatRolledAt(roll.rolled_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
