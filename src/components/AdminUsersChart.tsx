import AdminSignupLineChart from "./AdminSignupLineChart";
import {
  formatMemberSince,
  getProfileSignupBuckets,
  getRecentMemberProfiles,
  SIGNUP_CHART_DAYS,
  type AdminProfile,
} from "../lib/adminStats";

export default function AdminUsersChart({
  profiles,
  profileError,
}: {
  profiles: AdminProfile[];
  profileError?: string | null;
}) {
  const buckets = getProfileSignupBuckets(profiles);
  const recent = getRecentMemberProfiles(profiles);

  return (
    <section className="dashboard-panel admin-top-card flex flex-col p-4 sm:p-[1.2rem]">
      <div className="mb-3 flex shrink-0 flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-[var(--dash-foreground)] sm:text-lg">
            Registered users
          </h2>
          <p className="mt-[0.2rem] text-xs text-[var(--dash-muted)] sm:text-sm">
            Signups over the last {SIGNUP_CHART_DAYS} days
          </p>
        </div>
        <p className="text-2xl font-bold tabular-nums leading-none text-[var(--dash-foreground)] sm:text-3xl">
          {profiles.length}
        </p>
      </div>

      {profileError ? (
        <p className="mb-2 shrink-0 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-xs text-amber-800 dark:text-amber-200">
          {profileError}
        </p>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row lg:items-end">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-end">
          <AdminSignupLineChart buckets={buckets} />
        </div>

        <div className="flex min-h-0 w-full flex-col lg:max-h-full lg:w-52 lg:shrink-0">
          <p className="mb-1 shrink-0 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-subtle">
            Recent members
          </p>
          {recent.length === 0 ? (
            <p className="text-xs text-subtle">No registered users yet.</p>
          ) : (
            <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-0.5">
              {recent.map((profile) => (
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
          )}
        </div>
      </div>
    </section>
  );
}
