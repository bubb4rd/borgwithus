import React, { useState } from "react";
import { fmt, fmtDay, fmtDec, niceScale, parseDay } from "./metrics";

const clampIndex = (i, n) => Math.max(0, Math.min(n - 1, i));

function xLabels(days) {
  const n = days.length;
  const step = n <= 14 ? 1 : n <= 31 ? 3 : 10;
  const labels = [];
  for (let back = 0; back < n; back += step) {
    const i = n - 1 - back;
    labels.push({
      i,
      minor: n > 7 && (back / step) % 2 === 1,
      text:
        n <= 14 ? (
          <>
            {fmtDay(days[i], { weekday: "short" })}
            <br />
            {fmtDay(days[i], { day: "numeric" })}
          </>
        ) : (
          fmtDay(days[i], { month: "short", day: "numeric" })
        ),
    });
  }
  return labels;
}

// Daily stacked bars with optional previous-period ghost line, average line and a second,
// independently scaled line (e.g. running member count). Hover, tap or arrow keys pick a day.
export function DailyChart({ days, layers, ghost, avg, line, tip, label, empty, height = 220 }) {
  const [active, setActive] = useState(null);
  const n = days.length;
  const totals = days.map((_, i) => layers.reduce((s, layer) => s + layer.values[i], 0));
  const scale = niceScale(Math.max(0, ...totals, ...(ghost ?? [])));
  const y = (v) => 100 - (v / scale.max) * 100;
  const gap = n <= 14 ? 0.32 : n <= 31 ? 0.22 : 0.14;

  let linePoints = null;
  if (line && n > 0) {
    const lo = Math.min(...line.values);
    const hi = Math.max(...line.values);
    const span = hi - lo || 1;
    // Keep the line inside 12-88% of the plot so it never sits on the axis.
    linePoints = line.values.map((v, i) => ({
      x: i * 10 + 5,
      y: hi === lo ? 50 : 88 - ((v - lo) / span) * 76,
    }));
  }

  const pick = (event) => {
    if (!n) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setActive(clampIndex(Math.floor(((event.clientX - rect.left) / rect.width) * n), n));
  };

  const onKeyDown = (event) => {
    if (!n) return;
    const moves = { ArrowLeft: -1, ArrowRight: 1, Home: -n, End: n };
    if (!(event.key in moves)) return;
    event.preventDefault();
    setActive((current) => clampIndex((current ?? n - 1) + moves[event.key], n));
  };

  const tipAlign = active == null ? "" : active < n * 0.25 ? " is-left" : active > n * 0.75 ? " is-right" : "";

  return (
    <div className="dash-chart" style={{ "--dash-chart-h": `${height}px` }}>
      <div
        className="dash-chart-plot"
        role="group"
        tabIndex={0}
        aria-label={`${label}. Use left and right arrow keys to read each day.`}
        onPointerMove={pick}
        onPointerDown={pick}
        onPointerLeave={() => setActive(null)}
        onFocus={() => setActive((current) => current ?? n - 1)}
        onBlur={() => setActive(null)}
        onKeyDown={onKeyDown}
      >
        <div className="dash-chart-grid" aria-hidden="true">
          {scale.ticks.map((tick) => (
            <span key={tick} style={{ bottom: `${(tick / scale.max) * 100}%` }}>
              <em>{fmt(tick)}</em>
            </span>
          ))}
        </div>

        <svg
          className="dash-chart-svg"
          viewBox={`0 0 ${Math.max(n, 1) * 10} 100`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {active != null && (
            <rect className="dash-chart-hover" x={active * 10} y="0" width="10" height="100" />
          )}
          {days.map((day, i) => {
            let base = 0;
            return (
              <g key={day} className={active != null && active !== i ? "is-dim" : ""}>
                {layers.map((layer) => {
                  const v = layer.values[i];
                  if (!v) return null;
                  const top = base + v;
                  const rect = (
                    <rect
                      key={layer.key}
                      className={`dash-fill-${layer.tone}`}
                      x={i * 10 + gap * 5}
                      width={10 * (1 - gap)}
                      y={y(top)}
                      height={y(base) - y(top)}
                    />
                  );
                  base = top;
                  return rect;
                })}
              </g>
            );
          })}
          {ghost && n > 1 && (
            <polyline
              className="dash-chart-ghost"
              points={ghost.map((v, i) => `${i * 10 + 5},${y(v)}`).join(" ")}
              vectorEffect="non-scaling-stroke"
            />
          )}
          {linePoints && n > 1 && (
            <polyline
              className={`dash-chart-line dash-stroke-${line.tone}`}
              points={linePoints.map((p) => `${p.x},${p.y}`).join(" ")}
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>

        {avg > 0 && (
          <div className="dash-chart-avg" style={{ bottom: `${(avg / scale.max) * 100}%` }} aria-hidden="true">
            <em>avg {fmtDec(avg)}</em>
          </div>
        )}

        {linePoints && active != null && (
          <span
            className={`dash-chart-dot dash-bg-${line.tone}`}
            style={{ left: `${((active + 0.5) / n) * 100}%`, top: `${linePoints[active].y}%` }}
            aria-hidden="true"
          />
        )}

        {totals.every((v) => v === 0) && <p className="dash-chart-empty">{empty}</p>}

        {active != null && (
          <div
            className={`dash-tip${tipAlign}`}
            style={{ left: `${((active + 0.5) / n) * 100}%` }}
            role="status"
          >
            <p className="dash-tip-day">
              {parseDay(days[active]).toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
              {active === n - 1 && " · today"}
            </p>
            {tip(active)}
          </div>
        )}
      </div>

      <div className="dash-chart-x" aria-hidden="true">
        {xLabels(days).map(({ i, minor, text }) => (
          <span
            key={i}
            className={`${minor ? "is-minor" : ""}${i === n - 1 ? " is-today" : ""}`}
            style={{ left: `${((i + 0.5) / n) * 100}%` }}
          >
            {text}
          </span>
        ))}
      </div>
    </div>
  );
}

export function Sparkline({ values, tone }) {
  const n = values.length;
  if (n < 2) return <span className="dash-spark" aria-hidden="true" />;
  const max = Math.max(1, ...values);
  const points = values.map((v, i) => `${(i / (n - 1)) * 100},${29 - (v / max) * 27}`).join(" ");
  return (
    <svg className="dash-spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
      <polygon className={`dash-fill-${tone} dash-spark-area`} points={`0,30 ${points} 100,30`} />
      <polyline
        className={`dash-stroke-${tone} dash-spark-line`}
        points={points}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

// Horizontal 100% bar split by part; labels sit inside segments wide enough to hold them.
export function MixBar({ parts, label }) {
  const total = parts.reduce((s, part) => s + part.value, 0);
  if (!total) return <div className="dash-mix-bar is-empty" aria-label={`${label}: no data`} />;
  return (
    <div
      className="dash-mix-bar"
      role="img"
      aria-label={`${label}: ${parts
        .map((part) => `${part.label} ${Math.round((part.value / total) * 100)}%`)
        .join(", ")}`}
    >
      {parts.map((part) => {
        const share = part.value / total;
        return share > 0 ? (
          <span key={part.key} className={`dash-bg-${part.tone}`} style={{ flexGrow: share }}>
            {share >= 0.12 ? `${Math.round(share * 100)}%` : ""}
          </span>
        ) : null;
      })}
    </div>
  );
}
