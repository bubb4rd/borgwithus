import { useEffect, useState } from "react";
import { useReducedMotion } from "../hooks/useReducedMotion";

const STATUS_LINES = [
  "Thinking",
  "Thinking",
  "Scanning the BORG blacklist",
  "Tweaking phonetics",
  "Almost borged",
] as const;

function BorgingDots({ reducedMotion }: { reducedMotion: boolean }) {
  if (reducedMotion) {
    return <span className="text-subtle">...</span>;
  }

  return (
    <span className="inline-flex items-end gap-[3px] pb-[2px]" aria-hidden>
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="borging-dot h-[5px] w-[5px] rounded-full bg-muted"
          style={{ animationDelay: `${index * 0.16}s` }}
        />
      ))}
    </span>
  );
}

export function BorgingIndicator({
  showStatus = true,
  compact = false,
  className = "",
}: {
  showStatus?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const reducedMotion = useReducedMotion();
  const [statusIndex, setStatusIndex] = useState(0);

  useEffect(() => {
    if (!showStatus || reducedMotion) return;

    const interval = window.setInterval(() => {
      setStatusIndex((current) => (current + 1) % STATUS_LINES.length);
    }, 2400);

    return () => window.clearInterval(interval);
  }, [showStatus, reducedMotion]);

  return (
    <span
      className={`inline-flex flex-col ${compact ? "gap-0" : "gap-1"} ${className}`}
      role="status"
      aria-label="Generating BORG name"
    >
      <span className="inline-flex items-baseline gap-0.5">
        <span className="text-sm font-medium text-muted">BORGing</span>
        <BorgingDots reducedMotion={reducedMotion} />
      </span>
      {showStatus && !compact ? (
        <span
          key={reducedMotion ? "static" : statusIndex}
          className={`text-xs text-subtle ${reducedMotion ? "" : "borging-status"}`}
        >
          {STATUS_LINES[statusIndex]}
        </span>
      ) : null}
    </span>
  );
}
