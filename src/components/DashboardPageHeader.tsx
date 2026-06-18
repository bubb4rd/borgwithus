import type { ReactNode } from "react";
import { Link } from "react-router-dom";

type DashboardPageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  primaryAction?: { label: string; to: string };
  secondaryAction?: { label: string; to: string };
};

export default function DashboardPageHeader({
  eyebrow,
  title,
  description,
  action,
  primaryAction,
  secondaryAction,
}: DashboardPageHeaderProps) {
  const actions =
    action ??
    (primaryAction || secondaryAction ? (
      <div className="flex flex-wrap gap-3">
        {primaryAction && (
          <Link to={primaryAction.to} className="dash-btn-primary">
            {primaryAction.label}
          </Link>
        )}
        {secondaryAction && (
          <Link to={secondaryAction.to} className="dash-btn-secondary">
            {secondaryAction.label}
          </Link>
        )}
      </div>
    ) : null);

  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="dash-eyebrow">{eyebrow}</p>}
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-[var(--dash-foreground)] sm:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--dash-muted)]">
            {description}
          </p>
        )}
      </div>
      {actions}
    </div>
  );
}
