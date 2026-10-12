import React, { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { Empty, Panel } from "./Panel";
import { fmt, fmtDateTime, fmtPct } from "./metrics";

// The home page's generator A/B test (get_generator_ab): the BORG/MIO + BORG AI cards ("classic")
// against the jug configurator ("jug"). Runs over a fixed range of UTC days, from the first real
// view unless a start is picked, so the whole test stays in view; admins' browsers and ?gen= QA
// visits are left out. The main measure is the share of visitors who named a borg (a BORG or
// BORG AI roll), the one thing both layouts do the same way.
const VARIANTS = [
  { key: "classic", label: "Classic" },
  { key: "jug", label: "Jug" },
];

const count = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};
const share = (part, whole) => (whole > 0 ? part / whole : null);

const ROWS = [
  { label: "Visitors", value: (v) => fmt(v.visitors) },
  { label: "Named a borg", value: (v) => `${fmtPct(share(v.namers, v.visitors))} (${fmt(v.namers)})`, strong: true },
  { label: "Rolled anything", value: (v) => `${fmtPct(share(v.rollers, v.visitors))} (${fmt(v.rollers)})` },
  { label: "Borg rolls", value: (v) => fmt(v.borg) },
  // A tapped flavour counts as a MiO roll on the jug, a random reroll on classic: not comparable.
  { label: "Mio rolls", value: (v) => fmt(v.mio) },
  { label: "AI rolls", value: (v) => fmt(v.ai) },
  { label: "Clicked sign up", value: (v) => `${fmtPct(share(v.signupClickers, v.visitors))} (${fmt(v.signupClickers)})` },
  { label: "Signed up", value: (v) => `${fmtPct(share(v.signups, v.visitors))} (${fmt(v.signups)})` },
  // Only the jug can save or share an image.
  { label: "Savers", value: (v, key) => (key === "jug" ? fmt(v.savers) : "—") },
  { label: "Sharers", value: (v, key) => (key === "jug" ? fmt(v.sharers) : "—") },
];

function normalize(raw) {
  const variants = Object.fromEntries(
    VARIANTS.map(({ key }) => {
      const v = raw?.variants?.[key] ?? {};
      return [
        key,
        {
          visitors: count(v.visitors),
          namers: count(v.namers),
          rollers: count(v.rollers),
          borg: count(v.rolls?.borg),
          mio: count(v.rolls?.mio),
          ai: count(v.rolls?.ai),
          signupClickers: count(v.signup_clickers),
          signups: count(v.signups),
          savers: count(v.savers),
          sharers: count(v.sharers),
        },
      ];
    })
  );
  return {
    from: raw?.from ?? null,
    to: raw?.to ?? null,
    days: count(raw?.days),
    startedAt: raw?.started_at ?? null,
    variants,
  };
}

// ---------- statistics ----------

// Standard normal CDF (Abramowitz–Stegun 7.1.26, |error| < 1.5e-7).
function normalCdf(z) {
  const t = 1 / (1 + 0.3275911 * (Math.abs(z) / Math.SQRT2));
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = 1 - poly * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}

const twoSidedP = (z) => 2 * (1 - normalCdf(Math.abs(z)));

/** Jug minus classic for a share of visitors: the gap, its 95% interval and a two-sided p. */
export function compareShares(classic, jug) {
  const [x1, n1, x2, n2] = [classic.x, classic.n, jug.x, jug.n];
  if (!n1 || !n2) return null;
  const p1 = x1 / n1;
  const p2 = x2 / n2;
  const pooled = (x1 + x2) / (n1 + n2);
  const sePooled = Math.sqrt(pooled * (1 - pooled) * (1 / n1 + 1 / n2));
  const se = Math.sqrt((p1 * (1 - p1)) / n1 + (p2 * (1 - p2)) / n2);
  const diff = p2 - p1;
  return {
    diff,
    low: diff - 1.96 * se,
    high: diff + 1.96 * se,
    p: sePooled > 0 ? twoSidedP(diff / sePooled) : 1,
  };
}

/** p for visitors split this unevenly when assignment is 50/50 (a sample ratio mismatch). */
export function splitP(n1, n2) {
  const total = n1 + n2;
  return total > 0 ? twoSidedP((n1 - n2) / Math.sqrt(total)) : 1;
}

/** Visitors per group to catch a gap of `lift` from `base` 80% of the time at p < 0.05. */
export function visitorsNeeded(base, lift) {
  const p2 = Math.min(base + lift, 0.99);
  const mean = (base + p2) / 2;
  const a = 1.959964 * Math.sqrt(2 * mean * (1 - mean));
  const b = 0.841621 * Math.sqrt(base * (1 - base) + p2 * (1 - p2));
  return Math.ceil(((a + b) / (p2 - base)) ** 2);
}

const points = (r) => `${r >= 0 ? "+" : "−"}${Math.abs(r * 100).toFixed(1)} pts`;
const fmtP = (p) => (p < 0.001 ? "< 0.001" : p.toFixed(3));

function Verdict({ variants }) {
  const { classic, jug } = variants;
  const test = compareShares({ x: classic.namers, n: classic.visitors }, { x: jug.namers, n: jug.visitors });
  const split = splitP(classic.visitors, jug.visitors);
  const base = share(classic.namers, classic.visitors);

  let headline = "Not enough visitors in both groups yet.";
  let tone = "";
  if (test) {
    if (test.p < 0.05) {
      headline = `Jug ${test.diff > 0 ? "ahead" : "behind"}: a real difference (p ${fmtP(test.p)}).`;
      tone = test.diff > 0 ? "dash-tone-up" : "dash-tone-down";
    } else {
      headline = `No clear difference yet (p ${fmtP(test.p)}).`;
    }
  }

  return (
    <div className="dash-ab-verdict">
      <p className={`dash-ab-headline ${tone}`}>{headline}</p>
      {test && (
        <p className="dash-note">
          Named a borg, jug vs classic: <b>{points(test.diff)}</b> (95% range {points(test.low)} to{" "}
          {points(test.high)}).
          {base != null && base > 0 && base < 0.9 && (
            <>
              {" "}
              Catching a 10-point gap takes about <b>{fmt(visitorsNeeded(base, 0.1))}</b> visitors per group; a
              5-point gap about <b>{fmt(visitorsNeeded(base, 0.05))}</b>.
            </>
          )}
        </p>
      )}
      {split < 0.01 && (
        <p className="dash-note dash-tone-down">
          The split is off ({fmt(classic.visitors)} vs {fmt(jug.visitors)} visitors, p {fmtP(split)}). Groups are
          assigned 50/50, so check the tracking before trusting the result.
        </p>
      )}
    </div>
  );
}

// Loads alongside the dashboard: again whenever the dates change, the test is (re)started or the
// dashboard refreshes. The test counts from the moment an admin starts it (start_generator_ab), so
// testing done before launch, even the same day, stays out.
export default function GeneratorAb({ loadedAt }) {
  const [state, setState] = useState({ data: null, error: null });
  const [range, setRange] = useState({ from: "", to: "" });
  const [starts, setStarts] = useState(0);
  const [starting, setStarting] = useState(false);
  const latest = useRef(0);

  useEffect(() => {
    const id = ++latest.current;
    supabase
      .rpc("get_generator_ab", { p_from: range.from || null, p_to: range.to || null })
      .then(
        (result) => result,
        (error) => ({ error })
      )
      .then((result) => {
        if (id !== latest.current) return;
        setState((current) =>
          result.error
            ? { ...current, error: result.error.message || "Request failed" }
            : { data: normalize(result.data), error: null }
        );
      });
  }, [range, loadedAt, starts]);

  const start = async () => {
    const restart = Boolean(state.data?.startedAt);
    if (restart && !window.confirm("Restart the count? Everything before now drops out of the results.")) return;
    setStarting(true);
    const { error: startError } = await supabase.rpc("start_generator_ab");
    setStarting(false);
    if (startError) setState((current) => ({ ...current, error: startError.message || "Request failed" }));
    else setStarts((n) => n + 1);
  };

  useEffect(
    () => () => {
      latest.current += 1;
    },
    []
  );

  const { data, error } = state;
  const empty = data && VARIANTS.every(({ key }) => data.variants[key].visitors === 0);
  const setDate = (field) => (event) => setRange((current) => ({ ...current, [field]: event.target.value }));

  return (
    <Panel
      className="dash-ab"
      title="Generator A/B"
      sub={
        data?.from
          ? `${!range.from && data.startedAt ? `Since ${fmtDateTime(data.startedAt)}` : `From ${data.from}`} to ${data.to} · admins and ?gen= QA visits left out`
          : "Admins and ?gen= QA visits left out"
      }
      aside={
        <div className="dash-ab-range">
          {data && (
            <button type="button" className="dash-legend-item is-on" onClick={start} disabled={starting}>
              {data.startedAt ? "Restart the count" : "Start the test now"}
            </button>
          )}
          <label>
            From
            <input type="date" value={range.from} max={range.to || undefined} onChange={setDate("from")} />
          </label>
          <label>
            To
            <input type="date" value={range.to} min={range.from || undefined} onChange={setDate("to")} />
          </label>
          {(range.from || range.to) && (
            <button type="button" className="dash-legend-item is-on" onClick={() => setRange({ from: "", to: "" })}>
              Whole test
            </button>
          )}
        </div>
      }
    >
      {error && <Empty>Couldn't load the A/B numbers ({error}).</Empty>}
      {data && !data.startedAt && (
        <p className="dash-note dash-ab-unstarted">
          Not started: these numbers include anything logged before launch. Press <b>Start the test now</b> once
          the jug is live.
        </p>
      )}
      {!data ? (
        !error && <Empty>Counting…</Empty>
      ) : empty ? (
        <Empty>No generator views logged in this range.</Empty>
      ) : (
        <>
          <Verdict variants={data.variants} />
          <div className="dash-table-scroll">
            <table className="dash-table">
              <thead>
                <tr>
                  <th scope="col">Metric</th>
                  {VARIANTS.map(({ key, label }) => (
                    <th key={key} scope="col">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => (
                  <tr key={row.label}>
                    <th scope="row">{row.label}</th>
                    {VARIANTS.map(({ key }) => (
                      <td key={key} className={row.strong ? "is-strong" : ""}>
                        {row.value(data.variants[key], key)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Panel>
  );
}
