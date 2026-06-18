import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  getWeeklyRollBuckets,
  maxBucketCount,
  type DayBucket,
} from "../lib/dashboardChart";

function barTone(count: number, max: number) {
  if (count === 0) return "dash-chart-bar-empty";
  if (count >= max) return "dash-chart-bar-solid";
  if (count >= max * 0.5) return "dash-chart-bar-mid";
  return "dash-chart-bar-light";
}

export default function DashboardActivityChart() {
  const { user } = useAuth();
  const [buckets, setBuckets] = useState<DayBucket[]>([]);

  useEffect(() => {
    if (!user?.id) {
      setBuckets([]);
      return;
    }

    const refresh = () => setBuckets(getWeeklyRollBuckets());
    refresh();
    window.addEventListener("user-data:update", refresh);
    return () => window.removeEventListener("user-data:update", refresh);
  }, [user?.id]);

  const max = maxBucketCount(buckets);

  return (
    <section className="dashboard-panel p-5 sm:p-6 lg:col-span-2">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[var(--dash-foreground)]">
            Roll activity
          </h2>
          <p className="mt-1 text-sm text-[var(--dash-muted)]">
            Your generator rolls over the last 7 days
          </p>
        </div>
        <Link
          to="/dashboard/history"
          className="text-sm font-medium text-cyan hover:underline"
        >
          View all
        </Link>
      </div>

      <div className="flex h-52 items-end justify-between gap-2 sm:gap-3">
        {buckets.map((bucket, i) => {
          const height = bucket.count === 0 ? 12 : 24 + (bucket.count / max) * 120;
          return (
            <div
              key={`${bucket.label}-${i}`}
              className="flex flex-1 flex-col items-center gap-2"
            >
              <div
                className={`dash-chart-bar w-full max-w-10 ${barTone(bucket.count, max)}`}
                style={{ height: `${height}px` }}
                title={`${bucket.count} rolls`}
              />
              <span className="text-xs font-medium text-[var(--dash-muted)]">
                {bucket.label}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
