import { useCallback, useEffect, useState } from "react";
import AdminCatalogMixCard from "../components/AdminCatalogMixCard";
import AdminCatalogStatsCard from "../components/AdminCatalogStatsCard";
import { ADMIN_CATALOG_STACK_CLASS } from "../lib/adminListLayout";
import AdminBorgsPanel from "../components/AdminBorgsPanel";
import AdminCommunityPanel from "../components/AdminCommunityPanel";
import AdminUsersChart from "../components/AdminUsersChart";
import AdminSplashScreen from "../components/AdminSplashScreen";
import AdminSyncIndicator from "../components/AdminSyncIndicator";
import BorgOfTheDay from "../components/BorgOfTheDay";
import AdminShell from "../components/AdminShell";
import { catalogUpdateEventName } from "../lib/borgCatalog";
import { aiFeedbackUpdateEventName } from "../lib/aiFeedback";
import { runWithAdminSplashTiming } from "../lib/adminSplash";
import { loadAdminSnapshot, type AdminSnapshot } from "../lib/adminStats";
import {
  getSharedDataModeLabel,
  getSharedSyncStatus,
  SHARED_SYNC_EVENT,
  type SharedDataModeLabel,
} from "../lib/sharedBorgData";

const SPLASH_FADE_MS = 300;

export default function AdminPage() {
  const [snapshot, setSnapshot] = useState<AdminSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [splashVisible, setSplashVisible] = useState(true);
  const [splashMounted, setSplashMounted] = useState(true);
  const [dataMode, setDataMode] = useState<SharedDataModeLabel>(() =>
    getSharedDataModeLabel(),
  );

  const hideSplash = useCallback(() => {
    setSplashVisible(false);
    window.setTimeout(() => setSplashMounted(false), SPLASH_FADE_MS);
  }, []);

  const refresh = useCallback(async (withSplash = false, hydrate = false) => {
    if (withSplash) {
      setSplashMounted(true);
      setSplashVisible(true);
    }
    setLoading(true);

    try {
      const load = () => loadAdminSnapshot({ hydrate });
      const data = withSplash
        ? await runWithAdminSplashTiming(load)
        : await load();
      setSnapshot(data);
    } finally {
      setLoading(false);
      if (withSplash) hideSplash();
    }
  }, [hideSplash]);

  useEffect(() => {
    void refresh(true, true);
  }, [refresh]);

  useEffect(() => {
    const refreshLiveStatus = () =>
      setDataMode(getSharedDataModeLabel(getSharedSyncStatus()));
    refreshLiveStatus();
    window.addEventListener(SHARED_SYNC_EVENT, refreshLiveStatus);
    return () => window.removeEventListener(SHARED_SYNC_EVENT, refreshLiveStatus);
  }, []);

  useEffect(() => {
    let refreshTimer: number | undefined;

    const scheduleRefresh = () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        void refresh(false, false);
      }, 300);
    };

    window.addEventListener(catalogUpdateEventName(), scheduleRefresh);
    window.addEventListener("leaderboard:update", scheduleRefresh);
    window.addEventListener("user-data:update", scheduleRefresh);
    window.addEventListener(aiFeedbackUpdateEventName(), scheduleRefresh);
    return () => {
      window.clearTimeout(refreshTimer);
      window.removeEventListener(catalogUpdateEventName(), scheduleRefresh);
      window.removeEventListener("leaderboard:update", scheduleRefresh);
      window.removeEventListener("user-data:update", scheduleRefresh);
      window.removeEventListener(aiFeedbackUpdateEventName(), scheduleRefresh);
    };
  }, [refresh]);

  return (
    <AdminShell>
      {splashMounted ? <AdminSplashScreen visible={splashVisible} /> : null}

      <button
        type="button"
        onClick={() => void refresh(true, true)}
        disabled={loading}
        aria-label={`Refresh data (${dataMode})`}
        className="fixed bottom-6 right-6 z-50 flex h-11 cursor-pointer items-center rounded-full border border-[var(--dash-border)] bg-[var(--admin-surface)] text-sm font-semibold text-[var(--dash-foreground)] shadow-[var(--dash-shadow)] transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="flex h-full items-center px-3.5">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={loading ? "animate-spin" : ""}
            aria-hidden
          >
            <path d="M21 12a9 9 0 1 1-3-6.7" />
            <path d="M21 3v6h-6" />
          </svg>
        </span>
        <span
          className="h-6 w-px shrink-0 bg-[var(--dash-border)]/40"
          aria-hidden
        />
        <span className="flex items-center gap-2 px-3.5">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${
              dataMode === "Live" ? "bg-[#3ECF8E]" : "bg-red-500"
            }`}
            aria-hidden
          />
          {dataMode}
        </span>
      </button>

      <div className="space-y-4">
        <AdminSyncIndicator syncing={loading} variant="panel" />

      {!snapshot ? null : (
        <>
          {snapshot.profileError && (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
              Could not load profiles: {snapshot.profileError}
            </p>
          )}

          <div className="grid gap-4 lg:grid-cols-5 lg:items-start">
            <div className="lg:col-span-3">
              <AdminUsersChart
                profiles={snapshot.profiles}
                rolls={snapshot.rolls}
                profileError={snapshot.profileError ?? snapshot.profileAccessHint}
                rollsError={snapshot.rollsError}
              />
            </div>
            <div className="grid items-stretch gap-4 lg:col-span-2 lg:grid-cols-2">
              <div className={ADMIN_CATALOG_STACK_CLASS}>
                <AdminCatalogMixCard
                  borgTotal={snapshot.catalog.borgMixTotal}
                  tagSegments={snapshot.catalog.borgTagMix}
                />
                <AdminCatalogStatsCard totalRolls={snapshot.rolls.length} />
              </div>
              <BorgOfTheDay admin />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
            <AdminBorgsPanel
              catalogTotal={snapshot.catalog.total}
              aiGenerationTotal={snapshot.aiGenerations.total}
            />
            <AdminCommunityPanel
              ratings={snapshot.community.ratings}
              likes={snapshot.community.likes}
            />
          </div>
        </>
      )}
      </div>
    </AdminShell>
  );
}
