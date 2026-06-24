import type { ReactNode } from "react";

export type BorgAiStatusKind = "error" | "limit" | "idle";

const ICON_SIZE = 16;

function StatusIcon({ kind }: { kind: BorgAiStatusKind }) {
  const common = {
    width: ICON_SIZE,
    height: ICON_SIZE,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (kind === "error") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4" />
        <path d="M12 16h.01" />
      </svg>
    );
  }

  if (kind === "limit") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="10" />
        <path d="m4.9 4.9 14.2 14.2" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M12 3v3" />
      <path d="M12 18v3" />
      <path d="M3 12h3" />
      <path d="M18 12h3" />
      <circle cx="12" cy="12" r="4" />
    </svg>
  );
}

const STATUS_STYLES: Record<
  BorgAiStatusKind,
  { text: string; icon: string }
> = {
  error: {
    text: "text-red-700 dark:text-red-300",
    icon: "text-red-500 dark:text-red-400",
  },
  limit: {
    text: "text-muted",
    icon: "text-muted",
  },
  idle: {
    text: "text-subtle",
    icon: "text-subtle",
  },
};

export function BorgAiStatusMessage({
  kind,
  code,
  children,
}: {
  kind: BorgAiStatusKind;
  code?: string;
  children: ReactNode;
}) {
  const styles = STATUS_STYLES[kind];

  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <span className={`mt-0.5 shrink-0 ${styles.icon}`}>
        <StatusIcon kind={kind} />
      </span>
      <div className={`min-w-0 flex-1 text-sm leading-snug ${styles.text}`}>
        <p>{children}</p>
        {code ? (
          <p className="mt-1 font-mono text-[0.65rem] tracking-wide text-subtle">
            {code}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function classifyBorgAiError(message: string): BorgAiStatusKind {
  return /daily.*limit|limit reached/i.test(message) ? "limit" : "error";
}
