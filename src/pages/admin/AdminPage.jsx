import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import SubpageHeader from "../../components/SubpageHeader";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { timeAgo } from "../../lib/timeAgo";
import Borgs from "./Borgs";
import { DailyChart, MixBar, Sparkline } from "./charts";
import GeneratorAb from "./GeneratorAb";
import { Empty, Panel } from "./Panel";
import Studio from "./Studio";
import {
  KINDS,
  RANGES,
  change,
  dayFraction,
  derive,
  fetchDays,
  fmt,
  fmtDateTime,
  fmtDay,
  fmtDec,
  fmtPct,
  mix,
  normalize,
  parseRange,
  ratio,
  signed,
} from "./metrics";
import "./AdminPage.css";

const ROUTE = "/admin";
const TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;
const KIND_LABEL = { borg: "Borg", mio: "Mio", ai: "AI" };
const TABS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "borgs", label: "Borgs" },
  { key: "studio", label: "AI Borg Studio" },
];
const TAB_KEYS = new Set(TABS.map((option) => option.key));

/* ---------- small pieces ---------- */

function Delta({ cur, prev, range, format = fmt }) {
  const c = change(cur, prev);
  if (c.dir === "na") {
    return <p className="dash-delta is-na">No earlier {range}d to compare (90-day cap)</p>;
  }
  const arrow = { up: "▲", down: "▼", flat: "■" }[c.dir];
  return (
    <p className={`dash-delta is-${c.dir}`}>
      <strong>
        {arrow} {c.pct == null ? "new" : fmtPct(Math.abs(c.pct))}
      </strong>
      <span>
        {signed(c.abs, format)} vs prev {range}d ({format(prev)})
      </span>
    </p>
  );
}

function Pairs({ rows }) {
  return (
    <dl className="dash-pairs">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function TipRows({ rows }) {
  return (
    <dl className="dash-tip-rows">
      {rows.map(({ label, value, tone, strong }) => (
        <div key={label} className={strong ? "is-strong" : ""}>
          <dt>
            {tone && <i className={`dash-key dash-bg-${tone}`} />}
            {label}
          </dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ---------- KPI tiles ---------- */

function Kpi({ label, tone, m, range, foot }) {
  return (
    <li className={`dash-kpi is-${tone}`}>
      <p className="dash-kpi-label">
        <i className={`dash-key dash-bg-${tone}`} />
        {label}
        <span>{range}d</span>
      </p>
      <p className="dash-kpi-value">{fmt(m.total)}</p>
      <Delta cur={m.total} prev={m.prev} range={range} />
      <Sparkline values={m.values} tone={tone} />
      <Pairs rows={foot} />
    </li>
  );
}

function KpiGrid({ d, t, range }) {
  const { metrics: m } = d;
  const peak = (metric) => (metric.peak ? `${fmt(metric.peak.value)} · ${fmtDay(metric.peak.day)}` : "—");
  const shareOfRolls = (key) => fmtPct(ratio(m[key].total, m.rolls.total));
  return (
    <ul className="dash-kpis">
      <Kpi
        label="Rolls"
        tone="rolls"
        m={m.rolls}
        range={range}
        foot={[
          ["Per day", fmtDec(m.rolls.avg)],
          ["Peak day", peak(m.rolls)],
          ["All-time", fmt(d.allRolls)],
        ]}
      />
      <Kpi
        label="Signups"
        tone="members"
        m={m.members}
        range={range}
        foot={[
          ["Per day", fmtDec(m.members.avg)],
          ["Base growth", d.growth == null ? (m.members.total ? "new" : "—") : `+${fmtPct(d.growth)}`],
          ["Members", fmt(t.members)],
        ]}
      />
      {KINDS.map((kind) => (
        <Kpi
          key={kind.key}
          label={kind.label}
          tone={kind.tone}
          m={m[kind.key]}
          range={range}
          foot={[
            ["Share of rolls", shareOfRolls(kind.key)],
            kind.key === "ai"
              ? ["Credits today", `${fmt(t.ai_credits_today)} (UTC)`]
              : ["Per day", fmtDec(m[kind.key].avg)],
            ["All-time", fmt(t[kind.key])],
          ]}
        />
      ))}
    </ul>
  );
}

/* ---------- charts ---------- */

function RollsPanel({ d, range }) {
  const [hidden, setHidden] = useState([]);
  const visible = KINDS.filter((kind) => !hidden.includes(kind.key));
  const layers = visible.map((kind) => ({
    key: kind.key,
    tone: kind.tone,
    values: d.metrics[kind.key].values,
  }));
  const visibleTotal = layers.reduce((s, layer) => s + layer.values.reduce((a, b) => a + b, 0), 0);
  const ghost = d.previous
    ? d.previous.map((row) => visible.reduce((s, kind) => s + row[kind.key], 0))
    : null;

  const toggle = (key) =>
    setHidden((current) =>
      current.includes(key)
        ? current.filter((k) => k !== key)
        : current.length < KINDS.length - 1
          ? [...current, key]
          : current
    );

  const tip = (i) => {
    const row = d.current[i];
    const prevRow = d.previous?.[i];
    const rows = KINDS.map((kind) => ({
      label: kind.label,
      value: fmt(row[kind.key]),
      tone: kind.tone,
    }));
    rows.push({ label: "Total", value: fmt(row.rolls), strong: true });
    if (prevRow) {
      rows.push({ label: `Prev · ${fmtDay(prevRow.day)}`, value: fmt(prevRow.rolls) });
    }
    return <TipRows rows={rows} />;
  };

  return (
    <Panel
      className="dash-span-main"
      title="Rolls per day"
      sub={`${fmt(visibleTotal)} rolls shown · ${fmtDec(d.n ? visibleTotal / d.n : 0)}/day${
        ghost ? ` · line = previous ${range} days` : ""
      }`}
      aside={
        <div className="dash-legend" role="group" aria-label="Show roll kinds">
          {KINDS.map((kind) => {
            const on = !hidden.includes(kind.key);
            return (
              <button
                key={kind.key}
                type="button"
                className={`dash-legend-item${on ? " is-on" : ""}`}
                aria-pressed={on}
                onClick={() => toggle(kind.key)}
              >
                <i className={`dash-key dash-bg-${kind.tone}`} />
                {kind.label}
                <b>{fmt(d.metrics[kind.key].total)}</b>
              </button>
            );
          })}
          {ghost && (
            <span className="dash-legend-item is-static">
              <i className="dash-key is-ghost" />
              Prev {range}d
            </span>
          )}
        </div>
      }
    >
      <DailyChart
        days={d.current.map((row) => row.day)}
        layers={layers}
        ghost={ghost}
        avg={d.n ? visibleTotal / d.n : 0}
        tip={tip}
        label={`Rolls per day over the last ${range} days`}
        empty={`No rolls in the last ${range} days`}
        height={260}
      />
    </Panel>
  );
}

function SignupsPanel({ d, t, range }) {
  const m = d.metrics.members;
  const tip = (i) => {
    const prevRow = d.previous?.[i];
    const rows = [
      { label: "Signups", value: fmt(m.values[i]), tone: "members" },
      { label: "Members after", value: fmt(d.membersCurve[i]), tone: "line" },
    ];
    if (prevRow) rows.push({ label: `Prev · ${fmtDay(prevRow.day)}`, value: fmt(prevRow.members) });
    return <TipRows rows={rows} />;
  };

  return (
    <Panel
      className="dash-span-wide"
      title="Signups & members"
      sub={`${fmt(d.membersAtStart)} → ${fmt(t.members)} members · ${m.activeDays}/${d.n} days with a signup`}
      aside={
        <div className="dash-legend">
          <span className="dash-legend-item is-static">
            <i className="dash-key dash-bg-members" />
            Signups
          </span>
          <span className="dash-legend-item is-static">
            <i className="dash-key dash-bg-line" />
            Total members
          </span>
          {d.previous && (
            <span className="dash-legend-item is-static">
              <i className="dash-key is-ghost" />
              Prev {range}d
            </span>
          )}
        </div>
      }
    >
      <DailyChart
        days={d.current.map((row) => row.day)}
        layers={[{ key: "members", tone: "members", values: m.values }]}
        ghost={d.previous ? d.previous.map((row) => row.members) : null}
        avg={m.avg}
        line={m.total > 0 ? { values: d.membersCurve, tone: "line" } : null}
        tip={tip}
        label={`Signups per day over the last ${range} days`}
        empty={`No signups in the last ${range} days`}
        height={200}
      />
    </Panel>
  );
}

/* ---------- today ---------- */

function TodayPanel({ d, data, loadedAt }) {
  const today = d.today;
  if (!today) return null;
  const frac = dayFraction(data.timezone, loadedAt);
  const clock = loadedAt.toLocaleTimeString(undefined, {
    timeZone: data.timezone,
    hour: "numeric",
    minute: "2-digit",
  });
  const rows = [
    { key: "rolls", label: "Rolls" },
    { key: "members", label: "Signups" },
    { key: "borg", label: "Borg" },
    { key: "mio", label: "Mio" },
    { key: "ai", label: "AI" },
  ];
  const canPace = frac != null && frac >= 0.05;

  return (
    <Panel
      className="dash-span-side"
      title="Today"
      sub={`${clock} in ${data.timezone}${frac != null ? ` · ${Math.round(frac * 100)}% of day gone` : ""}`}
    >
      {frac != null && (
        <div className="dash-progress" aria-hidden="true">
          <span style={{ width: `${frac * 100}%` }} />
        </div>
      )}
      <div className="dash-table-scroll">
        <table className="dash-table dash-today">
          <thead>
            <tr>
              <th scope="col">Metric</th>
              <th scope="col">So far</th>
              <th scope="col" title="Today so far, scaled to a full day">
                Pace 24h
              </th>
              <th scope="col" title="Average of the full days before today in this range">
                Typical
              </th>
              <th scope="col" title="Same weekday one week ago">
                −7d
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ key, label }) => {
              const typical = d.typical(key);
              const pace = canPace ? today[key] / frac : null;
              const vs = pace != null && typical ? change(pace, typical) : null;
              return (
                <tr key={key}>
                  <th scope="row">{label}</th>
                  <td className="is-strong">{fmt(today[key])}</td>
                  <td className={vs ? `dash-tone-${vs.dir}` : ""}>
                    {pace == null ? "—" : fmt(Math.round(pace))}
                  </td>
                  <td>{fmtDec(typical)}</td>
                  <td>{d.lastWeek ? fmt(d.lastWeek[key]) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="dash-note">
        Pace = today so far scaled to 24h{canPace ? "" : " (too early to call)"}. Typical = average of
        the {d.n - 1} full days before today. AI credits used today: <b>{fmt(data.totals.ai_credits_today)}</b>{" "}
        (UTC day).
      </p>
    </Panel>
  );
}

/* ---------- mix & weekday ---------- */

function MixPanel({ d, t, range }) {
  const now = mix({ borg: d.metrics.borg.total, mio: d.metrics.mio.total, ai: d.metrics.ai.total });
  const before = d.previous
    ? mix({ borg: d.metrics.borg.prev, mio: d.metrics.mio.prev, ai: d.metrics.ai.prev })
    : null;
  const ever = mix({ borg: t.borg, mio: t.mio, ai: t.ai });
  const aiShift =
    before && now.parts[2].share != null && before.parts[2].share != null
      ? (now.parts[2].share - before.parts[2].share) * 100
      : null;
  const rows = [
    [`Last ${range}d`, now],
    before && [`Prev ${range}d`, before],
    ["All-time", ever],
  ].filter(Boolean);
  const who = [
    { key: "member", label: "Members", tone: "members", value: d.memberRolls },
    { key: "guest", label: "Guests", tone: "guest", value: t.guest_rolls },
  ];

  return (
    <Panel
      className="dash-span-narrow"
      title="Mix"
      sub={
        aiShift == null
          ? "Which generator people use"
          : `AI share ${signed(Math.round(aiShift * 10) / 10, (v) => `${fmtDec(v)}pp`)} vs prev ${range}d`
      }
    >
      <div className="dash-mix">
        {rows.map(([label, m]) => (
          <div key={label} className="dash-mix-row">
            <p>
              {label}
              <span>{fmt(m.total)}</span>
            </p>
            <MixBar parts={m.parts} label={`${label} roll mix`} />
          </div>
        ))}
        <div className="dash-legend is-compact">
          {KINDS.map((kind) => (
            <span key={kind.key} className="dash-legend-item is-static">
              <i className={`dash-key dash-bg-${kind.tone}`} />
              {kind.label}
            </span>
          ))}
        </div>
        <div className="dash-mix-row is-split">
          <p>
            Who rolls · all-time
            <span>{fmtPct(d.guestShare)} guests</span>
          </p>
          <MixBar parts={who} label="Rolls by members versus guests" />
          <p className="dash-note">
            {fmt(d.memberRolls)} member · {fmt(t.guest_rolls)} guest rolls
          </p>
        </div>
      </div>
    </Panel>
  );
}

function WeekdayPanel({ d }) {
  const max = Math.max(...d.weekdays.map((w) => w.rolls));
  const sampled = d.weekdays.filter((w) => w.days > 0);
  const busiest = sampled.length ? sampled.reduce((a, b) => (b.rolls > a.rolls ? b : a)) : null;
  const quietest = sampled.length ? sampled.reduce((a, b) => (b.rolls < a.rolls ? b : a)) : null;

  return (
    <Panel
      className="dash-span-narrow"
      title="By weekday"
      sub={`Avg rolls per day · ${d.weekdayPool} full days`}
    >
      {max > 0 ? (
        <>
          <ol className="dash-week">
            {d.weekdays.map((w) => (
              <li
                key={w.label}
                className={w === busiest ? "is-top" : ""}
                aria-label={`${w.label}: ${fmtDec(w.rolls)} rolls and ${fmtDec(w.members)} signups on average`}
              >
                <span className="dash-week-value">{fmtDec(w.rolls, w.rolls < 10 ? 1 : 0)}</span>
                <span className="dash-week-track">
                  <span style={{ height: `${(w.rolls / max) * 100}%` }} />
                </span>
                <span className="dash-week-day">{w.label}</span>
                <span className="dash-week-sub">{fmtDec(w.members)}</span>
              </li>
            ))}
          </ol>
          <p className="dash-note">
            Busiest <b>{busiest.label}</b> ({fmtDec(busiest.rolls)}/day) · quietest{" "}
            <b>{quietest.label}</b> ({fmtDec(quietest.rolls)}/day). Bottom row: avg signups.
          </p>
        </>
      ) : (
        <Empty>No full days with rolls yet.</Empty>
      )}
    </Panel>
  );
}

/* ---------- health ---------- */

function Stat({ label, value, note, to }) {
  return (
    <div className="dash-stat">
      <dt>{label}</dt>
      <dd className="dash-stat-value">{to ? <Link to={to}>{value} →</Link> : value}</dd>
      {note && <dd className="dash-stat-note">{note}</dd>}
    </div>
  );
}

function Health({ d, t, range }) {
  const m = d.metrics;
  const recent = d.recentMembersCount;
  return (
    <div className="dash-health">
      <Panel title="Members" sub="Who's signing up and sticking">
        <dl className="dash-stats">
          <Stat
            label="Confirmed email"
            value={fmtPct(d.confirmRate)}
            note={`${fmt(t.confirmed)} of ${fmt(t.members)} · ${fmt(t.members - t.confirmed)} unconfirmed`}
          />
          <Stat
            label={`Growth, ${range}d`}
            value={d.growth == null ? (m.members.total ? "new" : "—") : `+${fmtPct(d.growth)}`}
            note={`${fmt(m.members.total)} signups on a base of ${fmt(d.membersAtStart)}`}
          />
          <Stat
            label="Signups / day"
            value={fmtDec(m.members.avg)}
            note={m.members.prevAvg == null ? "no earlier window" : `prev ${range}d: ${fmtDec(m.members.prevAvg)}`}
          />
          <Stat
            label={`Newest ${recent}`}
            value={recent ? `${d.recentSignedIn}/${recent} signed in` : "—"}
            note={recent ? `${d.recentConfirmed}/${recent} confirmed email` : "no members yet"}
          />
        </dl>
      </Panel>
      <Panel title="Engagement" sub="How much rolling happens">
        <dl className="dash-stats">
          <Stat
            label="Rolls / member"
            value={fmtDec(d.rollsPerMember)}
            note="all-time member rolls ÷ members"
          />
          <Stat
            label="Guest share"
            value={fmtPct(d.guestShare)}
            note={`${fmt(t.guest_rolls)} of ${fmt(d.allRolls)} rolls, all-time`}
          />
          <Stat
            label={`In last ${range}d`}
            value={fmtPct(d.windowShare)}
            note="of all rolls ever made"
          />
          <Stat
            label="Active days"
            value={`${m.rolls.activeDays}/${d.n}`}
            note={`days with at least one roll`}
          />
        </dl>
      </Panel>
      <Panel title="Community" sub="Submissions and likes">
        <dl className="dash-stats">
          <Stat
            label="Waiting on review"
            value={fmt(t.pending)}
            to="/review"
            note={`${fmt(t.pending + d.decided)} submitted all-time`}
          />
          <Stat
            label="Approval rate"
            value={fmtPct(d.approvalRate)}
            note={`${fmt(t.approved)} approved · ${fmt(t.rejected)} rejected`}
          />
          <Stat
            label="Likes"
            value={fmt(t.likes)}
            note={`on ${fmt(t.liked_names)} names`}
          />
          <Stat label="Likes / name" value={fmtDec(d.likesPerName)} note="average over liked names" />
        </dl>
      </Panel>
    </div>
  );
}

/* ---------- lists ---------- */

function RecentRolls({ rows, guests }) {
  return (
    <Panel
      title="Recent rolls"
      sub={rows.length ? `${rows.length} latest · ${guests} by guests` : "Latest 12"}
    >
      {rows.length === 0 ? (
        <Empty>No rolls yet.</Empty>
      ) : (
        <ol className="dash-list">
          {rows.map((row) => (
            <li key={row.id} className="dash-row">
              <span className={`dash-kind dash-bg-${row.kind}`}>{KIND_LABEL[row.kind] ?? row.kind}</span>
              <div className="dash-row-main">
                <p className="dash-row-name">{row.name}</p>
                <p className="dash-row-meta">
                  {row.member ? <span>{row.member}</span> : <span className="is-guest">Guest</span>}
                </p>
              </div>
              <time className="dash-row-time" dateTime={row.rolled_at} title={fmtDateTime(row.rolled_at)}>
                {timeAgo(row.rolled_at)}
              </time>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

function RecentMembers({ rows, d }) {
  return (
    <Panel
      title="New members"
      sub={
        rows.length
          ? `${rows.length} newest · ${d.recentConfirmed} confirmed · ${d.recentSignedIn} signed in`
          : "Newest 8"
      }
    >
      {rows.length === 0 ? (
        <Empty>No members yet.</Empty>
      ) : (
        <ol className="dash-list">
          {rows.map((row) => {
            const name = row.name ?? row.email?.split("@")[0] ?? "Unknown";
            return (
              <li key={row.id} className="dash-row">
                <span className="dash-avatar" aria-hidden="true">
                  {name.charAt(0)}
                </span>
                <div className="dash-row-main">
                  <p className="dash-row-name">{name}</p>
                  <p className="dash-row-meta is-email">{row.email}</p>
                  <p className="dash-row-meta">
                    <span className={row.confirmed ? "is-ok" : "is-warn"}>
                      {row.confirmed ? "Confirmed" : "Unconfirmed"}
                    </span>
                    {" · "}
                    {row.last_sign_in_at ? (
                      <span title={fmtDateTime(row.last_sign_in_at)}>seen {timeAgo(row.last_sign_in_at)}</span>
                    ) : (
                      <span className="is-warn">never signed in</span>
                    )}
                  </p>
                </div>
                <time className="dash-row-time" dateTime={row.created_at} title={fmtDateTime(row.created_at)}>
                  {timeAgo(row.created_at)}
                </time>
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}

function MostLiked({ rows, d, t }) {
  const top = rows[0]?.likes ?? 0;
  return (
    <Panel
      className="is-paper"
      title="Most liked"
      sub={
        rows.length
          ? `Top ${rows.length} hold ${fmtPct(d.topLikedShare)} of ${fmt(t.likes)} likes`
          : "Top 10"
      }
    >
      {rows.length === 0 ? (
        <Empty>No likes yet.</Empty>
      ) : (
        <ol className="dash-board">
          {rows.map((row, i) => (
            <li key={row.name} className={i === 0 ? "is-first" : i === 1 ? "is-second" : ""}>
              <span className="dash-board-rank">{String(i + 1).padStart(2, "0")}</span>
              <span className="dash-board-name">{row.name}</span>
              <span className="dash-board-share">{fmtPct(ratio(row.likes, t.likes))}</span>
              <span className="dash-board-likes">♥ {fmt(row.likes)}</span>
              <span
                className="dash-board-bar"
                style={{ width: `${top ? (row.likes / top) * 100 : 0}%` }}
                aria-hidden="true"
              />
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

/* ---------- daily table ---------- */

function DailyTable({ d, range }) {
  const m = d.metrics;
  const rows = [...d.current].reverse();
  const curveByDay = Object.fromEntries(d.current.map((row, i) => [row.day, d.membersCurve[i]]));
  const cols = ["members", "borg", "mio", "ai", "rolls"];
  return (
    <details className="dash-panel dash-daily">
      <summary>
        <span className="dash-panel-title">Daily numbers</span>
        <span className="dash-panel-sub">
          {d.n} days · every count the charts are drawn from
        </span>
      </summary>
      <div className="dash-table-scroll">
        <table className="dash-table dash-daily-table">
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col">Signups</th>
              <th scope="col">Borg</th>
              <th scope="col">Mio</th>
              <th scope="col">AI</th>
              <th scope="col">Rolls</th>
              <th scope="col">AI share</th>
              <th scope="col">Members</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.day} className={i === 0 ? "is-today" : ""}>
                <th scope="row">
                  {fmtDay(row.day, { weekday: "short", month: "short", day: "numeric" })}
                </th>
                {cols.map((key) => (
                  <td key={key} className={row[key] === 0 ? "is-zero" : ""}>
                    {fmt(row[key])}
                  </td>
                ))}
                <td>{fmtPct(ratio(row.ai, row.rolls))}</td>
                <td>{fmt(curveByDay[row.day])}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total {range}d</th>
              {cols.map((key) => (
                <td key={key}>{fmt(m[key].total)}</td>
              ))}
              <td>{fmtPct(ratio(m.ai.total, m.rolls.total))}</td>
              <td />
            </tr>
            <tr>
              <th scope="row">Avg / day</th>
              {cols.map((key) => (
                <td key={key}>{fmtDec(m[key].avg)}</td>
              ))}
              <td />
              <td />
            </tr>
            {d.previous && (
              <tr>
                <th scope="row">Prev {range}d</th>
                {cols.map((key) => (
                  <td key={key}>{fmt(m[key].prev)}</td>
                ))}
                <td>{fmtPct(ratio(m.ai.prev, m.rolls.prev))}</td>
                <td />
              </tr>
            )}
          </tfoot>
        </table>
      </div>
    </details>
  );
}

/* ---------- page ---------- */

function Dashboard({ data, range, loadedAt }) {
  const d = useMemo(() => derive(data, range), [data, range]);
  const t = data.totals;
  const nothingYet =
    t.members === 0 && d.allRolls === 0 && t.likes === 0 && t.pending + t.approved + t.rejected === 0;

  return (
    <>
      {nothingYet && (
        <p className="dash-banner is-quiet" role="status">
          Nothing to count yet: no members, rolls, likes or submissions. The numbers fill in as people
          show up.
        </p>
      )}
      {t.pending > 0 && (
        <Link to="/review" className="dash-banner is-action">
          <span>
            <b>{fmt(t.pending)}</b> {t.pending === 1 ? "submission is" : "submissions are"} waiting on
            review
          </span>
          <span className="dash-banner-cta">Open review queue →</span>
        </Link>
      )}

      <KpiGrid d={d} t={t} range={range} />

      <div className="dash-grid">
        <RollsPanel d={d} range={range} />
        <TodayPanel d={d} data={data} loadedAt={loadedAt} />
        <SignupsPanel d={d} t={t} range={range} />
        <MixPanel d={d} t={t} range={range} />
        <WeekdayPanel d={d} />
      </div>

      <Health d={d} t={t} range={range} />

      <GeneratorAb range={range} loadedAt={loadedAt} />

      <div className="dash-lists">
        <RecentRolls rows={data.recentRolls} guests={d.recentGuestRolls} />
        <RecentMembers rows={data.recentMembers} d={d} />
        <MostLiked rows={data.topLiked} d={d} t={t} />
      </div>

      <DailyTable d={d} range={range} />
    </>
  );
}

function Skeleton() {
  return (
    <div className="dash-skeleton" role="status" aria-label="Loading dashboard">
      <div className="dash-skeleton-kpis">
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} />
        ))}
      </div>
      <div className="dash-skeleton-main">
        <span />
        <span />
      </div>
      <p className="dash-skeleton-text">Counting borgs…</p>
    </div>
  );
}

export default function AdminPage() {
  const { user, ready, online, isAdmin } = useAuth();
  const [params, setParams] = useSearchParams();
  const range = parseRange(params.get("days"));
  const tab = TAB_KEYS.has(params.get("tab")) ? params.get("tab") : "dashboard";
  const [state, setState] = useState({ status: "loading", data: null, range: null, loadedAt: null, error: null });
  const latest = useRef(0);

  const load = useCallback(async (days) => {
    const id = ++latest.current;
    setState((current) => ({ ...current, status: "loading" }));
    let result;
    try {
      result = await supabase.rpc("get_admin_dashboard", { p_tz: TIME_ZONE, p_days: fetchDays(days) });
    } catch (error) {
      result = { error };
    }
    // A newer request (range switch, refresh, unmount) supersedes this one.
    if (id !== latest.current) return;
    setState((current) =>
      result.error
        ? { ...current, status: "error", error: result.error.message || "Request failed" }
        : { status: "ready", data: normalize(result.data), range: days, loadedAt: new Date(), error: null }
    );
  }, []);

  useEffect(() => {
    if (isAdmin && tab === "dashboard") load(range);
  }, [isAdmin, tab, range, load]);

  useEffect(
    () => () => {
      latest.current += 1;
    },
    []
  );

  if (!online) return <Navigate to="/" replace />;
  if (!ready || isAdmin === null) return null;
  if (!user) return <Navigate to="/login" state={{ from: ROUTE }} replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  const { status, data, loadedAt, error } = state;
  const loading = status === "loading";
  const shownRange = state.range ?? range;
  const shown = data ? derive(data, shownRange) : null;

  const setRange = (next) => {
    const nextParams = new URLSearchParams(params);
    nextParams.set("days", String(next));
    setParams(nextParams, { replace: true });
  };

  const setTab = (next) => {
    const nextParams = new URLSearchParams(params);
    if (next === "dashboard") nextParams.delete("tab");
    else nextParams.set("tab", next);
    setParams(nextParams);
  };

  return (
    <div className="dash-page">
      <SubpageHeader>
        <Link to="/review" className="nav-link">
          Review queue{data?.totals.pending ? ` (${fmt(data.totals.pending)})` : ""}
        </Link>
      </SubpageHeader>
      <main className="dash-main">
        <div className="wrap">
          <nav className="dash-seg dash-tabs" aria-label="Admin sections">
            {TABS.map((option) => (
              <button
                key={option.key}
                type="button"
                className={option.key === tab ? "is-active" : ""}
                aria-current={option.key === tab ? "page" : undefined}
                onClick={() => setTab(option.key)}
              >
                {option.label}
              </button>
            ))}
          </nav>

          {tab === "studio" ? (
            <Studio />
          ) : tab === "borgs" ? (
            <Borgs />
          ) : (
            <>
              <div className="dash-head">
                <div>
                  <h1 className="dash-title">Dashboard</h1>
                  <p className="dash-meta">
                    {shown && shown.n > 0 && (
                      <span>
                        {fmtDay(shown.current[0].day)} – {fmtDay(shown.current[shown.n - 1].day)}
                      </span>
                    )}
                    <span>
                      Times in {data?.timezone ?? TIME_ZONE}
                      {data && data.timezone !== TIME_ZONE ? ` (your zone ${TIME_ZONE} unknown to the DB)` : ""}
                    </span>
                    {loadedAt && (
                      <span title={loadedAt.toLocaleString()}>
                        Updated {loadedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                      </span>
                    )}
                  </p>
                </div>
                <div className="dash-controls">
                  <div className="dash-seg" role="group" aria-label="Date range">
                    {RANGES.map((option) => (
                      <button
                        key={option}
                        type="button"
                        className={option === range ? "is-active" : ""}
                        aria-pressed={option === range}
                        onClick={() => setRange(option)}
                      >
                        {option}d
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="btn btn-acid btn-sm dash-refresh"
                    onClick={() => load(range)}
                    disabled={loading}
                  >
                    {loading ? "Loading…" : "Refresh"}
                  </button>
                </div>
              </div>

              {status === "error" && data && (
                <div className="dash-banner is-error" role="alert">
                  <span>
                    Couldn't refresh ({error}). Showing data from{" "}
                    {loadedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                    {state.range !== range ? ` for the last ${state.range} days` : ""}.
                  </span>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => load(range)}>
                    Retry
                  </button>
                </div>
              )}

              {data ? (
                <div className={`dash-body${loading ? " is-loading" : ""}`} aria-busy={loading}>
                  <Dashboard data={data} range={shownRange} loadedAt={loadedAt} />
                </div>
              ) : status === "error" ? (
                <div className="dash-failed" role="alert">
                  <p className="dash-panel-title">Couldn't load the dashboard.</p>
                  <p className="dash-note">{error}</p>
                  <button type="button" className="btn btn-acid btn-sm" onClick={() => load(range)}>
                    Try again
                  </button>
                </div>
              ) : (
                <Skeleton />
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
