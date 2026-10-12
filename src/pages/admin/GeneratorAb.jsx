import React, { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { Empty, Panel } from "./Panel";
import { fmt, fmtDec, fmtPct } from "./metrics";

// The home page's generator A/B test (get_generator_ab): the BORG/MIO + BORG AI cards ("classic")
// against the jug configurator ("jug"), over the dashboard's range in UTC days.
const VARIANTS = [
  { key: "classic", label: "Classic" },
  { key: "jug", label: "Jug" },
];

const count = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};
const rate = (value) => (value == null ? null : Number(value));

const ROWS = [
  { label: "Visitors", value: (v) => fmt(v.visitors) },
  { label: "Rollers", value: (v) => fmt(v.rollers) },
  { label: "Roll rate", value: (v) => fmtPct(v.rollRate), strong: true },
  { label: "Rolls / visitor", value: (v) => fmtDec(v.rollsPerVisitor, 2), strong: true },
  { label: "Borg rolls", value: (v) => fmt(v.borg) },
  { label: "Mio rolls", value: (v) => fmt(v.mio) },
  { label: "AI rolls", value: (v) => fmt(v.ai) },
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
          rollers: count(v.rollers),
          rollRate: rate(v.roll_rate),
          rollsPerVisitor: rate(v.rolls_per_visitor),
          borg: count(v.rolls?.borg),
          mio: count(v.rolls?.mio),
          ai: count(v.rolls?.ai),
          savers: count(v.savers),
          sharers: count(v.sharers),
        },
      ];
    })
  );
  return { days: count(raw?.days), variants };
}

// Loads alongside the dashboard: again whenever the range changes or the dashboard refreshes.
export default function GeneratorAb({ range, loadedAt }) {
  const [state, setState] = useState({ data: null, error: null });
  const latest = useRef(0);

  useEffect(() => {
    const id = ++latest.current;
    supabase
      .rpc("get_generator_ab", { p_days: range })
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
  }, [range, loadedAt]);

  useEffect(
    () => () => {
      latest.current += 1;
    },
    []
  );

  const { data, error } = state;
  const empty = data && VARIANTS.every(({ key }) => data.variants[key].visitors === 0);

  return (
    <Panel
      className="dash-ab"
      title="Generator A/B"
      sub={`Last ${data?.days || range} UTC days · visitors who saw the generator, and only their rolls`}
    >
      {error && <Empty>Couldn't load the A/B numbers ({error}).</Empty>}
      {!data ? (
        !error && <Empty>Counting…</Empty>
      ) : empty ? (
        <Empty>No generator views logged yet.</Empty>
      ) : (
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
      )}
    </Panel>
  );
}
