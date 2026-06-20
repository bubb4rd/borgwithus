import { useEffect, useState } from "react";
import {
  getSharedSyncStatus,
  SHARED_SYNC_EVENT,
  type SharedSyncStatus,
  type SyncSourceStatus,
} from "../lib/sharedBorgData";

const SOURCE_LABELS: Record<
  keyof Pick<SharedSyncStatus, "catalog" | "botd" | "community" | "nameStats">,
  string
> = {
  catalog: "BORG catalog",
  botd: "BORG of the day",
  community: "Community stats",
  nameStats: "Likes & ratings",
};

function overallLabel(status: SharedSyncStatus) {
  if (!status.configured) return "Local only";

  const sources = [
    status.catalog,
    status.botd,
    status.community,
    status.nameStats,
  ];
  const remoteCount = sources.filter((source) => source === "remote").length;

  if (remoteCount === sources.length) return "Synced";
  if (remoteCount === 0) return "Local fallback";
  return "Partial sync";
}

function overallTone(status: SharedSyncStatus, syncing: boolean) {
  if (syncing) {
    return "border-cyan/25 bg-cyan/10 text-cyan";
  }

  if (!status.configured) {
    return "border-border bg-elevated/60 text-subtle";
  }

  const sources = [
    status.catalog,
    status.botd,
    status.community,
    status.nameStats,
  ];
  const remoteCount = sources.filter((source) => source === "remote").length;

  if (remoteCount === sources.length) {
    return "border-cyan/25 bg-cyan/10 text-cyan";
  }
  if (remoteCount === 0) {
    return "border-hazard/25 bg-hazard/10 text-hazard";
  }
  return "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300";
}

function sourceChipTone() {
  return "border-border/70 bg-elevated/40 text-foreground";
}

function SourceStatusLabel({ source }: { source: SyncSourceStatus }) {
  const text = sourceChipLabel(source);

  if (source === "remote") {
    return <span className="text-[#3ECF8E]">{text}</span>;
  }

  return <span className="text-red-500">{text}</span>;
}

function sourceChipLabel(source: SyncSourceStatus) {
  if (source === "remote") return "Live";
  if (source === "local") return "Local";
  return "N/A";
}

function formatSyncedAt(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

type AdminSyncIndicatorProps = {
  syncing?: boolean;
  variant?: "compact" | "panel";
};

export default function AdminSyncIndicator({
  syncing = false,
  variant = "compact",
}: AdminSyncIndicatorProps) {
  const [status, setStatus] = useState<SharedSyncStatus>(() => getSharedSyncStatus());
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const refresh = () => setStatus(getSharedSyncStatus());
    refresh();
    window.addEventListener(SHARED_SYNC_EVENT, refresh);
    return () => window.removeEventListener(SHARED_SYNC_EVENT, refresh);
  }, []);

  const label = syncing ? "Syncing..." : overallLabel(status);
  const syncedAt = formatSyncedAt(status.updatedAt);
  const tone = overallTone(status, syncing);
  const isSynced = label === "Synced";

  useEffect(() => {
    if (syncing || !isSynced) {
      setDismissed(false);
    }
  }, [syncing, isSynced]);

  if (variant === "panel" && dismissed && isSynced && !syncing) {
    return null;
  }

  if (variant === "panel") {
    const sourceChips = (
      Object.entries(SOURCE_LABELS) as [keyof typeof SOURCE_LABELS, string][]
    ).map(([key, name]) => (
      <span
        key={key}
        className={`inline-flex min-w-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[0.6rem] font-semibold sm:gap-1.5 sm:px-2.5 sm:py-1 sm:text-xs ${sourceChipTone()}`}
      >
        <span className="truncate text-muted">{name}</span>
        <SourceStatusLabel source={status[key]} />
      </span>
    ));

    return (
      <section
        className={`rounded-2xl border px-4 py-3 sm:px-5 ${tone}`}
        aria-live="polite"
        aria-label={`Data sync status: ${label}`}
      >
        <div className="flex items-center gap-3 md:flex-wrap md:justify-between md:gap-3">
          <div className="flex shrink-0 items-center gap-2">
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                syncing
                  ? "animate-pulse bg-cyan"
                  : label === "Synced"
                    ? "bg-cyan"
                    : label === "Partial sync"
                      ? "bg-amber-500"
                      : "bg-hazard"
              }`}
              aria-hidden
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold">{label}</p>
              <p className="text-xs opacity-80">
                {syncedAt ? `Last sync ${syncedAt}` : "Waiting for first sync"}
              </p>
            </div>
          </div>

          <div className="flex min-w-0 flex-1 items-center justify-end gap-2 md:flex-none">
            <div className="grid min-w-0 flex-1 grid-cols-2 gap-1.5 sm:gap-2 md:flex md:flex-1 md:flex-wrap md:justify-end">
              {sourceChips}
            </div>

            {isSynced && !syncing ? (
              <button
                type="button"
                onClick={() => setDismissed(true)}
                aria-label="Dismiss sync status"
                className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border/70 text-muted transition-colors hover:bg-hover hover:text-foreground"
              >
                ×
              </button>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  const title = [
    label,
    syncedAt ? `Last sync ${syncedAt}` : null,
    ...Object.entries(SOURCE_LABELS).map(([key, name]) =>
      `${name}: ${sourceChipLabel(status[key as keyof typeof SOURCE_LABELS])}`,
    ),
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div
      title={title}
      className={`inline-flex max-w-[7.5rem] items-center gap-1.5 truncate rounded-full border px-2.5 py-1 text-[0.65rem] font-semibold sm:max-w-none sm:gap-2 sm:px-3 sm:py-1.5 sm:text-xs ${tone}`}
      aria-label={`Data sync status: ${label}`}
    >
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${
          syncing
            ? "animate-pulse bg-cyan"
            : label === "Synced"
              ? "bg-cyan"
              : label === "Partial sync"
                ? "bg-amber-500"
                : "bg-hazard"
        }`}
        aria-hidden
      />
      <span>{label}</span>
    </div>
  );
}
