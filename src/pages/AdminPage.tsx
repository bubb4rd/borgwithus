import { useCallback, useEffect, useState } from "react";
import AdminCatalogMixCard from "../components/AdminCatalogMixCard";
import AdminBorgList from "../components/AdminBorgList";
import AdminCommunityPanel from "../components/AdminCommunityPanel";
import AdminUsersChart from "../components/AdminUsersChart";
import BorgOfTheDay from "../components/BorgOfTheDay";
import AdminShell from "../components/AdminShell";
import { catalogUpdateEventName } from "../lib/borgCatalog";
import { loadAdminSnapshot, type AdminSnapshot } from "../lib/adminStats";

export default function AdminPage() {
  const [snapshot, setSnapshot] = useState<AdminSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const data = await loadAdminSnapshot();
    setSnapshot(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onCatalogUpdate = () => void refresh();
    window.addEventListener(catalogUpdateEventName(), onCatalogUpdate);
    return () => window.removeEventListener(catalogUpdateEventName(), onCatalogUpdate);
  }, [refresh]);

  return (
    <AdminShell>
      <button
        type="button"
        onClick={() => void refresh()}
        disabled={loading}
        aria-label="Refresh data"
        className="glass fixed bottom-6 right-6 z-50 flex h-11 cursor-pointer items-center gap-2 rounded-full border border-[var(--dash-border)] px-4 text-sm font-semibold text-[var(--dash-foreground)] transition-colors hover:border-cyan/40 hover:bg-cyan/10 disabled:cursor-not-allowed disabled:opacity-60"
      >
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
        Refresh
      </button>

      {loading || !snapshot ? (
        <p className="text-sm text-muted">Loading admin data...</p>
      ) : (
        <div className="space-y-6">
          {snapshot.profileError && (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
              Could not load profiles: {snapshot.profileError}
            </p>
          )}

          <div className="grid gap-4 lg:grid-cols-5 lg:items-start">
            <div className="lg:col-span-3">
              <AdminUsersChart
                profiles={snapshot.profiles}
                profileError={snapshot.profileError ?? snapshot.profileAccessHint}
              />
            </div>
            <div className="grid items-stretch gap-4 lg:col-span-2 lg:grid-cols-2">
              <AdminCatalogMixCard
                borg={snapshot.catalog.borg}
                mio={snapshot.catalog.mio}
                ai={snapshot.catalog.ai}
                total={snapshot.catalog.total}
                adminAdded={snapshot.catalog.adminAdded}
              />
              <BorgOfTheDay admin />
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <AdminBorgList totalCount={snapshot.catalog.total} />
            <AdminCommunityPanel
              ratings={snapshot.community.ratings}
              likes={snapshot.community.likes}
            />
          </div>
        </div>
      )}
    </AdminShell>
  );
}
