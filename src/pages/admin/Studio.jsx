import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { timeAgo } from "../../lib/timeAgo";
import { fmt, fmtDateTime, fmtDec, fmtPct, ratio } from "./metrics";
import { Empty, Panel } from "./Panel";
import * as api from "./studioApi";
import { dpoLines, sftLines, TRAINING_TARGET, trainingPairs } from "./trainingData";
import "./Studio.css";

const VERDICTS = {
  good: { icon: "👍", label: "Good" },
  bad: { icon: "👎", label: "Bad" },
  fixed: { icon: "✏️", label: "Fixed" },
};
const NO_RATINGS = { good: 0, bad: 0, fixed: 0, model_good: 0, model_rated: 0 };
const BLANK_DRAFT = { baseId: null, label: "", systemPrompt: "", temperature: 1, exampleCount: 3 };
const MAX_LABEL_LENGTH = 60;
const MAX_EXAMPLE_COUNT = 30;

const versionName = (prompt) => (prompt ? `v${prompt.version}` : "a deleted version");
const versionLabel = (prompt) => `v${prompt.version}${prompt.label ? ` · ${prompt.label}` : ""}`;
const ratedTotal = (r) => r.good + r.bad + r.fixed;
// Measured on the model server: it reads ~20 prompt tokens a second and the reply (~80 tokens)
// takes ~25 s; a token is ~4 characters. The user message (style names, used lists, theme) adds
// ~150 tokens, and the edge function cuts the model off at 60 s.
const READ_TOKENS_PER_SECOND = 20;
const TOKENS_PER_EXAMPLE = 12;
const USER_MESSAGE_TOKENS = 150;
const REPLY_SECONDS = 25;
const MODEL_CUTOFF_SECONDS = 60;

/** Who made a name: the model's real swap, the code's swap of the model's original, or a tacked-on model name. */
function SourceChip({ source, swap = true }) {
  if (!source) return null;
  const [label, title] =
    source === "code"
      ? ["Code", "The code swapped a sound in the original the model picked"]
      : swap
        ? ["AI", "The model's own line, and it really swaps a sound"]
        : ["AI · tacked on", "The model's own line; borg is tacked on, not swapped in. Members only get these when nothing better came back"];
  return (
    <span className={`studio-source is-${source}${swap ? "" : " is-tacked"}`} title={title}>
      {label}
    </span>
  );
}

const draftFrom = (prompt) => ({
  baseId: prompt.id,
  label: "",
  systemPrompt: prompt.system_prompt,
  temperature: prompt.temperature,
  exampleCount: prompt.example_count,
});

function Ago({ iso }) {
  return (
    <time dateTime={iso} title={fmtDateTime(iso)}>
      {timeAgo(iso)}
    </time>
  );
}

function Seg({ label, options, value, onChange }) {
  return (
    <div className="dash-seg" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          className={option.key === value ? "is-active" : ""}
          aria-pressed={option.key === value}
          disabled={option.disabled}
          onClick={() => onChange(option.key)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function VersionSelect({ label, prompts, value, onChange }) {
  return (
    <label className="studio-field is-inline">
      <span>{label}</span>
      <select
        className="studio-input"
        value={value ?? ""}
        onChange={(event) => onChange(prompts.find((p) => String(p.id) === event.target.value)?.id ?? null)}
      >
        {[...prompts].reverse().map((prompt) => (
          <option key={prompt.id} value={prompt.id}>
            {versionLabel(prompt)}
            {prompt.is_live ? " (live)" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

function Tally({ counts, unrated }) {
  return (
    <p className="studio-tally">
      {Object.entries(VERDICTS).map(([key, v]) => (
        <span key={key} className={`is-${key}`}>
          {v.icon} {fmt(counts[key])}
        </span>
      ))}
      {unrated != null && <span>{fmt(unrated)} unrated</span>}
    </p>
  );
}

/* ---------- playground ---------- */

/**
 * One name on offer. The ref exposes what the Playground's keyboard shortcuts need: rate good,
 * open the 👎 or ✏️ form, star, submit or close an open form, and focus the row. Each does what
 * the matching button would, and nothing while that button is disabled.
 */
const ResultRow = forwardRef(function ResultRow({ pair, rating, starred, current, onRate, onStar, onSelect }, ref) {
  const [open, setOpen] = useState(null);
  const [reason, setReason] = useState("");
  const [fixedName, setFixedName] = useState("");
  const [saving, setSaving] = useState(false);
  const [starring, setStarring] = useState(false);
  const [error, setError] = useState(null);
  // Bumped to focus the open form's field again when its shortcut is pressed while it is open.
  const [focusRequest, setFocusRequest] = useState(0);
  const rowRef = useRef(null);
  const reasonRef = useRef(null);
  const fixedRef = useRef(null);
  const verdict = rating?.verdict ?? null;
  const shownName = verdict === "fixed" ? rating.fixed_name : pair.name;

  useEffect(() => {
    if (open) (open === "fixed" ? fixedRef : reasonRef).current?.focus();
  }, [open, focusRequest]);

  const save = async (next) => {
    setSaving(true);
    setError(null);
    try {
      await onRate({
        verdict: next,
        reason: next === "good" ? "" : reason.trim(),
        fixedName: next === "fixed" ? fixedName.trim() : "",
      });
      // The form's fields are about to go: keep focus on the row so the shortcuts carry on.
      if (open && rowRef.current?.contains(document.activeElement)) rowRef.current.focus();
      setOpen(null);
    } catch (failure) {
      setError(failure.message);
    }
    setSaving(false);
  };

  const toggle = (kind) => {
    setError(null);
    if (open === kind) {
      setOpen(null);
      return;
    }
    setOpen(kind);
    setReason(rating?.reason ?? "");
    setFixedName(rating?.fixed_name ?? pair.name);
  };

  const close = () => {
    setOpen(null);
    rowRef.current?.focus();
  };

  const star = async () => {
    setStarring(true);
    setError(null);
    try {
      await onStar({ original: pair.original, name: shownName });
    } catch (failure) {
      setError(failure.message);
    }
    setStarring(false);
  };

  const fixedTrimmed = fixedName.trim();
  const canSaveFix = fixedTrimmed && api.nameKey(fixedTrimmed) !== api.nameKey(pair.name);
  const canSubmit = !saving && (open === "bad" ? Boolean(reason.trim()) : open === "fixed" && Boolean(canSaveFix));

  const rateGood = () => {
    setOpen(null);
    save("good");
  };

  useImperativeHandle(ref, () => ({
    focus: () => rowRef.current?.focus(),
    isOpen: () => open !== null,
    good: () => {
      if (!saving && verdict !== "good") rateGood();
    },
    openForm: (kind) => {
      if (saving) return;
      if (open === kind) setFocusRequest((n) => n + 1);
      else toggle(kind);
    },
    star: () => {
      if (!starred && !starring && !saving) star();
    },
    submit: () => {
      if (canSubmit) save(open);
    },
    close,
  }));

  return (
    <li
      ref={rowRef}
      tabIndex={-1}
      aria-current={current || undefined}
      onFocus={onSelect}
      className={`studio-result${verdict ? ` is-${verdict}` : ""}${pair.swap === false ? " is-tacked" : ""}${
        current ? " is-current" : ""
      }`}
    >
      <div className="studio-result-main">
        <p className="studio-original">
          {pair.original} <SourceChip source={pair.source} swap={pair.swap !== false} />
        </p>
        <p className={`studio-name${verdict === "fixed" ? " is-struck" : ""}`}>{pair.name}</p>
        {verdict === "fixed" && <p className="studio-name is-fixed">→ {rating.fixed_name}</p>}
        {verdict && verdict !== "good" && rating.reason && <p className="studio-reason">“{rating.reason}”</p>}
      </div>
      <div className="studio-verdicts" role="group" aria-label={`Rate ${pair.name}`}>
        <button
          type="button"
          className="studio-verdict is-good"
          aria-pressed={verdict === "good"}
          aria-keyshortcuts="1"
          title="Good"
          disabled={saving || verdict === "good"}
          onClick={rateGood}
        >
          👍
        </button>
        <button
          type="button"
          className="studio-verdict is-bad"
          aria-pressed={verdict === "bad"}
          aria-expanded={open === "bad"}
          aria-keyshortcuts="2"
          title="Bad: say why"
          disabled={saving}
          onClick={() => toggle("bad")}
        >
          👎
        </button>
        <button
          type="button"
          className="studio-verdict is-fixed"
          aria-pressed={verdict === "fixed"}
          aria-expanded={open === "fixed"}
          aria-keyshortcuts="3"
          title="Fix it: type the right name"
          disabled={saving}
          onClick={() => toggle("fixed")}
        >
          ✏️
        </button>
        <button
          type="button"
          className="studio-verdict is-star"
          aria-pressed={starred}
          aria-keyshortcuts="S"
          title={starred ? "In the example pool" : `Add ${shownName} to the examples`}
          disabled={starred || starring || saving}
          onClick={star}
        >
          ⭐
        </button>
      </div>
      {open && (
        <form
          className="studio-draft"
          onSubmit={(event) => {
            event.preventDefault();
            save(open);
          }}
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            close();
          }}
        >
          {open === "fixed" && (
            <label className="studio-field">
              <span>Fixed name</span>
              <input
                ref={fixedRef}
                className="studio-input"
                type="text"
                value={fixedName}
                onChange={(event) => setFixedName(event.target.value)}
              />
            </label>
          )}
          <label className="studio-field">
            <span>{open === "bad" ? "Why is it bad?" : "What was wrong (optional)"}</span>
            <input
              ref={reasonRef}
              className="studio-input"
              type="text"
              value={reason}
              placeholder={open === "bad" ? "Tacked on, not a sound swap…" : ""}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <div className="studio-draft-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={close}>
              Cancel
            </button>
            <button type="submit" className="btn btn-acid btn-sm" disabled={!canSubmit}>
              {saving ? "Saving…" : open === "bad" ? "Save 👎" : "Save fix"}
            </button>
          </div>
        </form>
      )}
      {error && (
        <p className="studio-row-error" role="alert">
          {error}
        </p>
      )}
    </li>
  );
});

/** Seconds since `since`, ticking, so a 30-50 s batch doesn't look stuck. */
function Elapsed({ since }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return <>{Math.max(0, Math.round((now - since) / 1000))} s</>;
}

/** What the batch turned into: originals on offer out of those asked for, and who made the names. */
function RunStats({ run, kept, missing }) {
  const ai = run.pairs.filter((pair) => pair.source === "model" && pair.swap).length;
  const code = run.pairs.filter((pair) => pair.source === "code").length;
  const tacked = run.pairs.filter((pair) => !pair.swap).length;
  return (
    <p className="studio-run-stats">
      <span>
        <b>{fmt(kept)}</b> of {fmt(api.BATCH_SIZE)} originals
      </span>
      <span className="is-model">
        <b>{fmt(ai)}</b> AI swaps
      </span>
      <span className="is-code">
        <b>{fmt(code)}</b> code swaps
      </span>
      <span className={tacked ? "" : "is-zero"}>
        <b>{fmt(tacked)}</b> tacked on
      </span>
      <span className={run.lost.length ? "is-lost" : "is-zero"}>
        <b>{fmt(run.lost.length)}</b> thrown out
      </span>
      <span className={missing ? "is-lost" : "is-zero"}>
        <b>{fmt(missing)}</b> missing
      </span>
      {run.ms != null && <span>{fmtDec(run.ms / 1000, 1)} s</span>}
    </p>
  );
}

const LOST_REASONS = {
  "known-original": ["Thrown out", "The original repeats one already on the site or earlier in this batch"],
  "known-name": ["Thrown out", "Its name repeats a known one, and the code had no fresh swap to offer instead"],
  "no-name": ["Failed", "The model wrote no usable borg name for it, and the code couldn't swap a sound"],
};

/**
 * One row per original asked for that offers no name: the model's originals thrown out or
 * failed, and a placeholder for each line the model never wrote, so a short batch says why.
 */
function LostRows({ lost, missing }) {
  if (!lost.length && !missing) return null;
  return (
    <ul className="studio-results studio-lost" aria-label="Originals with no name on offer">
      {lost.map((draft, n) => {
        const [label, why] = LOST_REASONS[draft.reason] ?? ["Thrown out", "Dropped by the batch rules"];
        return (
          <li key={`lost-${n}`} className="studio-result is-lost">
            <div className="studio-result-main">
              <p className="studio-original">
                {draft.original} <span className="studio-source is-lost">{label}</span>
              </p>
              {draft.name && <p className="studio-name is-struck">{draft.name}</p>}
              <p className="studio-reason">{why}</p>
            </div>
          </li>
        );
      })}
      {Array.from({ length: missing }, (_, n) => (
        <li key={`missing-${n}`} className="studio-result is-lost">
          <div className="studio-result-main">
            <p className="studio-original">
              No original <span className="studio-source is-missing">Missing</span>
            </p>
            <p className="studio-reason">
              The model didn't write a usable “Original → name” line for it: see the raw reply below
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Exactly what the model was sent and said back. */
function UnderTheHood({ prompt, raw, dropped = [] }) {
  if (!prompt) return null;
  return (
    <details className="studio-under">
      <summary>Under the hood: prompt sent and raw reply</summary>
      <p className="studio-under-label">System</p>
      <pre>{prompt.system}</pre>
      <p className="studio-under-label">User</p>
      <pre>{prompt.user}</pre>
      {raw != null && (
        <>
          <p className="studio-under-label">Raw reply</p>
          <pre>{raw || "(empty)"}</pre>
        </>
      )}
      {dropped.length > 0 && (
        <>
          <p className="studio-under-label">Dropped as repeats</p>
          <pre>{dropped.map((d) => `${d.original} -> ${d.name ?? "(no usable name)"}`).join("\n")}</pre>
        </>
      )}
    </details>
  );
}

function BatchColumn({
  tag,
  run,
  prompts,
  promptId,
  onPick,
  exampleKeys,
  onRate,
  onStar,
  onMakeLive,
  livePending,
  active,
  cursor,
  onActivate,
  onSelectRow,
  registerRow,
}) {
  const prompt = prompts.find((p) => p.id === promptId) ?? null;
  const runPrompt = run && prompts.find((p) => p.id === run.promptId);
  const counts = { ...NO_RATINGS };
  if (run) Object.values(run.ratings).forEach((r) => (counts[r.verdict] += 1));
  const rated = counts.good + counts.bad + counts.fixed;
  // Every original asked for is on offer, thrown out or failed (run.lost), or missing.
  const kept = run ? new Set(run.pairs.map((pair) => api.nameKey(pair.original))).size : 0;
  const missing = run ? Math.max(0, api.BATCH_SIZE - kept - run.lost.length) : 0;

  // Clicking or tabbing into a column points the keyboard shortcuts at it.
  return (
    <div className={`studio-col${active ? " is-active" : ""}`} onPointerDown={onActivate} onFocus={onActivate}>
      <div className="studio-col-head">
        <VersionSelect label={tag} prompts={prompts} value={promptId} onChange={onPick} />
        {prompt &&
          (prompt.is_live ? (
            <span className="studio-live">Live</span>
          ) : (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={livePending}
              onClick={() => onMakeLive(prompt)}
            >
              Make {versionName(prompt)} live
            </button>
          ))}
      </div>
      {prompt && (
        <p className="dash-note">
          Temp <b>{fmtDec(prompt.temperature, 2)}</b> · <b>{prompt.example_count}</b> format examples ·{" "}
          {prompt.ratings.model_rated
            ? `${fmtPct(ratio(prompt.ratings.model_good, prompt.ratings.model_rated))} of ${fmt(prompt.ratings.model_rated)} rated AI names good`
            : "no AI names rated yet"}
        </p>
      )}

      {!run ? (
        <Empty>Pick a theme and generate.</Empty>
      ) : run.status === "queued" ? (
        <Empty>Waiting for {run.queuedBehind}: the model server answers one batch at a time.</Empty>
      ) : run.status === "loading" ? (
        <>
          <p className="dash-note studio-cooking" role="status">
            Cooking… <Elapsed since={run.startedAt} /> · usually 30–50 s, cut off at 60 s
          </p>
          <ol className="studio-results is-loading" aria-busy="true" aria-label="Generating">
            {Array.from({ length: api.BATCH_SIZE }, (_, i) => (
              <li key={i} className="studio-result is-ghost" />
            ))}
          </ol>
        </>
      ) : run.status === "error" ? (
        <>
          <p className="dash-banner is-error" role="alert">
            {run.error}
          </p>
          <UnderTheHood prompt={run.prompt} raw={null} />
        </>
      ) : (
        <>
          <div className="studio-run-meta">
            <p className="dash-note">
              {runPrompt && run.promptId !== promptId ? `${versionName(runPrompt)} · ` : ""}
              {run.theme ? `Theme “${run.theme}”` : `Random topic: ${run.topic ?? "?"}`}
            </p>
            <Tally counts={counts} unrated={run.pairs.length - rated} />
          </div>
          <RunStats run={run} kept={kept} missing={missing} />
          {run.pairs.length === 0 ? (
            <Empty>No names on offer: every original was thrown out, failed or missing.</Empty>
          ) : (
            <ol className="studio-results">
              {run.pairs.map((pair, n) => {
                const rating = run.ratings[pair.key];
                const shown = rating?.verdict === "fixed" ? rating.fixed_name : pair.name;
                return (
                  <ResultRow
                    key={pair.key}
                    ref={registerRow(pair.key)}
                    pair={pair}
                    rating={rating}
                    starred={exampleKeys.has(api.nameKey(shown))}
                    current={n === cursor}
                    onRate={(input) => onRate(run, pair, input)}
                    onStar={onStar}
                    onSelect={() => onSelectRow(n)}
                  />
                );
              })}
            </ol>
          )}
          <LostRows lost={run.lost} missing={missing} />
          <UnderTheHood prompt={run.prompt} raw={run.raw} dropped={run.dropped} />
        </>
      )}
    </div>
  );
}

/** The Playground's keyboard shortcuts, always on show so they don't need a help screen. */
function KeyLegend({ target }) {
  return (
    <div className="studio-keys">
      <span className="studio-keys-title">Keys</span>
      <span>
        <kbd>J</kbd> <kbd>K</kbd> next / previous
      </span>
      <span>
        <kbd>1</kbd> 👍
      </span>
      <span>
        <kbd>2</kbd> 👎
      </span>
      <span>
        <kbd>3</kbd> ✏️
      </span>
      <span>
        <kbd>S</kbd> ⭐
      </span>
      <span>
        <kbd>Enter</kbd> save
      </span>
      <span>
        <kbd>Esc</kbd> close / leave the theme
      </span>
      <span>
        <kbd>G</kbd> generate
      </span>
      {target && <span className="studio-keys-target">Acting on {target}: click a column to switch</span>}
    </div>
  );
}

function Playground({ prompts, exampleKeys, onRate, onStar, onMakeLive, livePending }) {
  const [mode, setMode] = useState("single");
  const [theme, setTheme] = useState("");
  const [picks, setPicks] = useState([null, null]);
  const [runs, setRuns] = useState([null, null]);
  // Keyboard target: the highlighted result in each column, and the column the keys act on.
  const [cursors, setCursors] = useState([0, 0]);
  const [activeCol, setActiveCol] = useState(0);
  const [cookNext, setCookNext] = useState(false);
  // The one background batch, if any: { id, promptId, theme, startedAt, promise, status, result,
  // error, dropped }. A dropped batch still cooking keeps the slot until it lands, so a second
  // background request never runs beside it.
  const [next, setNext] = useState(null);
  const seq = useRef(0);
  const rows = useRef(new Map());
  const latest = useRef(null);
  latest.current = { runs, cursors };

  const live = prompts.find((p) => p.is_live) ?? prompts[prompts.length - 1] ?? null;
  const challenger = [...prompts].reverse().find((p) => p.id !== live?.id) ?? live;
  const defaults = [live?.id ?? null, challenger?.id ?? null];
  const pickFor = (i) => (prompts.some((p) => p.id === picks[i]) ? picks[i] : defaults[i]);
  const columns = mode === "compare" ? [0, 1] : [0];
  const busy = columns.some((i) => runs[i]?.status === "loading" || runs[i]?.status === "queued");
  const target = mode === "compare" ? activeCol : 0;
  const nextMatches = next && !next.dropped && next.promptId === pickFor(0) && next.theme === theme.trim();

  const setRun = (i, id, update) =>
    setRuns((current) => current.map((run, k) => (k === i && run?.seq === id ? { ...run, ...update } : run)));

  const dropNext = () => setNext((job) => (job?.status === "loading" ? { ...job, dropped: true } : null));

  // With "Keep the next batch cooking" on, a batch that lands starts the next one with the same
  // version and theme in the background (one version only: compare already runs two in a row).
  const shown = runs[0];
  useEffect(() => {
    if (!cookNext || mode !== "single" || next || shown?.status !== "ready") return;
    const id = ++seq.current;
    const settle = (update) => setNext((job) => (job?.id !== id ? job : job.dropped ? null : { ...job, ...update }));
    const promise = api.generateBatch({ promptId: shown.promptId, theme: shown.theme, topic: null });
    promise.then(
      (result) => settle({ status: "ready", result }),
      (failure) => settle({ status: "error", error: failure.message })
    );
    setNext({ id, promptId: shown.promptId, theme: shown.theme, startedAt: Date.now(), promise, status: "loading" });
  }, [cookNext, mode, next, shown]);

  // One batch at a time: the model server is slow and serial, so two at once would only make both
  // time out. With a blank theme, B reuses A's random topic so the two versions face the same task.
  // A background batch for the same version and theme is shown as soon as it is ready (or picked up
  // while it cooks); one for another version or theme is waited out, then thrown away.
  const generate = async () => {
    if (busy || !prompts.length) return;
    const used = theme.trim();
    const job = next;
    const reuse = mode === "single" && Boolean(nextMatches) && job.status !== "error";
    const ids = columns.map(() => ++seq.current);
    setRuns((current) =>
      current.map((run, k) => {
        const c = columns.indexOf(k);
        if (c === -1) return run;
        return {
          seq: ids[c],
          status: "queued",
          queuedBehind: c === 0 ? "the background batch" : "A",
          startedAt: Date.now(),
          theme: used,
          topic: null,
          promptId: pickFor(k),
          pairs: [],
          dropped: [],
          lost: [],
          ratings: {},
          error: null,
        };
      })
    );
    setCursors((current) => current.map((n, k) => (columns.includes(k) ? 0 : n)));
    if (reuse) setNext(null);
    else dropNext();
    if (!reuse && job?.status === "loading") await job.promise.catch(() => {});
    let topic = null;
    for (const [c, i] of columns.entries()) {
      const id = ids[c];
      const adopted = reuse && c === 0 ? job : null;
      if (!adopted?.result) setRun(i, id, { status: "loading", startedAt: adopted?.startedAt ?? Date.now() });
      try {
        const result = adopted
          ? adopted.result ?? (await adopted.promise)
          : await api.generateBatch({ promptId: pickFor(i), theme: used, topic });
        topic = topic ?? result.topic;
        setRun(i, id, {
          status: "ready",
          ...result,
          pairs: result.pairs.map((pair, n) => ({ ...pair, key: `${id}-${n}` })),
        });
      } catch (failure) {
        setRun(i, id, { status: "error", error: failure.message, prompt: failure.prompt, topic: failure.topic });
      }
    }
  };

  const selectRow = (i, n) => {
    setActiveCol(i);
    setCursors((current) => (current[i] === n ? current : current.map((m, k) => (k === i ? n : m))));
  };

  const focusRow = (i, n) => {
    selectRow(i, n);
    rows.current.get(latest.current.runs[i].pairs[n].key)?.focus();
  };

  // After a 👍 the highlight moves on to the next unrated name, wrapping round, unless it was moved
  // meanwhile. Focus follows it unless it went somewhere else (say, the theme field).
  const advancePast = (i, runSeq, key) => {
    const { runs: now, cursors: at } = latest.current;
    const run = now[i];
    if (run?.seq !== runSeq) return;
    const from = run.pairs.findIndex((p) => p.key === key);
    if (at[i] !== from) return;
    const upcoming = [...run.pairs.slice(from + 1), ...run.pairs.slice(0, from)].find((p) => !run.ratings[p.key]);
    if (!upcoming) return;
    const focused = document.activeElement;
    if (!focused || focused === document.body || focused.closest(".studio-results")) {
      focusRow(i, run.pairs.indexOf(upcoming));
    } else {
      selectRow(i, run.pairs.indexOf(upcoming));
    }
  };

  const rate = async (i, run, pair, input) => {
    const prior = run.ratings[pair.key];
    const rating = await onRate(
      {
        id: prior?.id,
        promptId: run.promptId,
        theme: run.theme,
        original: pair.original,
        name: pair.name,
        source: pair.source,
        ...input,
      },
      prior
    );
    setRuns((current) =>
      current.map((r, k) => (k === i && r?.seq === run.seq ? { ...r, ratings: { ...r.ratings, [pair.key]: rating } } : r))
    );
    if (input.verdict === "good") advancePast(i, run.seq, pair.key);
  };

  // Shortcuts work anywhere on the page except while typing, and never with a modifier held.
  const onKey = useRef(null);
  onKey.current = (event) => {
    const el = event.target;
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (key === "g") {
      event.preventDefault();
      generate();
      return;
    }
    const run = runs[target];
    const pairs = run?.status === "ready" ? run.pairs : [];
    if (!pairs.length) return;
    const at = Math.min(cursors[target], pairs.length - 1);
    const row = rows.current.get(pairs[at].key);
    switch (key) {
      case "j":
      case "ArrowDown":
        focusRow(target, Math.min(at + 1, pairs.length - 1));
        break;
      case "k":
      case "ArrowUp":
        focusRow(target, Math.max(at - 1, 0));
        break;
      case "1":
        row?.good();
        break;
      case "2":
        row?.openForm("bad");
        break;
      case "3":
        row?.openForm("fixed");
        break;
      case "s":
        row?.star();
        break;
      case "Enter":
        // Buttons, links and summaries keep their own Enter.
        if (!row?.isOpen() || el.closest("button, a, summary")) return;
        row.submit();
        break;
      case "Escape":
        if (!row?.isOpen()) return;
        row.close();
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  useEffect(() => {
    const listener = (event) => onKey.current(event);
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, []);

  const registerRow = (key) => (handle) => {
    if (handle) rows.current.set(key, handle);
    else rows.current.delete(key);
  };

  let cookNote = null;
  if (cookNext) {
    if (mode !== "single") cookNote = "Paused while comparing two versions.";
    else if (!next) cookNote = "Starts cooking as soon as a batch lands.";
    else if (next.dropped) cookNote = "Finishing a background batch nobody wants any more; it gets thrown away.";
    else if (next.status === "loading")
      cookNote = nextMatches ? (
        <>
          Next batch cooking… <Elapsed since={next.startedAt} />. Generate picks it up.
        </>
      ) : (
        "The next batch is cooking for another version or theme: Generate waits for it, then makes a fresh one."
      );
    else if (next.status === "error") cookNote = `The next batch failed (${next.error}). Generate makes a fresh one.`;
    else
      cookNote = nextMatches
        ? "Next batch ready: Generate shows it instantly."
        : "The next batch is for another version or theme: Generate makes a fresh one.";
  }

  return (
    <Panel
      className="dash-span-full"
      title="Playground"
      aside={
        <Seg
          label="Playground mode"
          value={mode}
          onChange={(key) => {
            setMode(key);
            if (key !== "single") dropNext();
          }}
          options={[
            { key: "single", label: "One version" },
            { key: "compare", label: "Compare two", disabled: prompts.length < 2 },
          ]}
        />
      }
    >
      <form
        className="studio-generate"
        onSubmit={(event) => {
          event.preventDefault();
          generate();
        }}
      >
        <label className="studio-field">
          <input
            className="studio-input"
            type="text"
            value={theme}
            maxLength={api.MAX_THEME_LENGTH}
            placeholder="NBA, 2000s rap, horror movies…"
            onChange={(event) => setTheme(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") event.currentTarget.blur();
            }}
          />
        </label>
        <button
          type="submit"
          className="btn btn-acid btn-sm studio-generate-btn"
          aria-keyshortcuts="G"
          disabled={busy || !prompts.length}
        >
          {busy ? "Generating…" : mode === "compare" ? "Generate A, then B" : `Generate ${api.BATCH_SIZE}`}
        </button>
      </form>

      <div className="studio-cook">
        <button
          id="studio-cook"
          type="button"
          role="switch"
          className="studio-switch"
          aria-checked={cookNext}
          aria-describedby="studio-cook-hint"
          onClick={() => {
            setCookNext(!cookNext);
            if (cookNext) dropNext();
          }}
        />
        <div className="studio-cook-text">
          <label htmlFor="studio-cook" className="studio-cook-label">
            Keep the next batch cooking
          </label>
          <p id="studio-cook-hint" className="dash-note">
            One version only. As soon as a batch lands, the next one with the same version and theme starts in the
            background, so Generate shows it instantly; unrated names of the batch it replaces are dropped. The model
            server is shared with members' live rolls and answers one request at a time, so while it cooks, members
            wait.
          </p>
          {cookNote && (
            <p className="dash-note studio-cook-status" role="status">
              {cookNote}
            </p>
          )}
        </div>
      </div>

      <KeyLegend target={mode === "compare" ? (target === 0 ? "A" : "B") : null} />

      {prompts.length === 0 ? (
        <Empty>No prompt versions yet. Save the first one below.</Empty>
      ) : (
        <div className={`studio-cols${mode === "compare" ? " is-compare" : ""}`}>
          {columns.map((i) => (
            <BatchColumn
              key={i}
              tag={mode === "compare" ? (i === 0 ? "A" : "B") : "Version"}
              run={runs[i]}
              prompts={prompts}
              promptId={pickFor(i)}
              onPick={(id) => setPicks((current) => current.map((p, k) => (k === i ? id : p)))}
              exampleKeys={exampleKeys}
              onRate={(run, pair, input) => rate(i, run, pair, input)}
              onStar={onStar}
              onMakeLive={onMakeLive}
              livePending={livePending}
              active={mode === "compare" && target === i}
              cursor={target === i ? cursors[i] : null}
              onActivate={() => setActiveCol(i)}
              onSelectRow={(n) => selectRow(i, n)}
              registerRow={registerRow}
            />
          ))}
        </div>
      )}
    </Panel>
  );
}

/* ---------- prompt versions ---------- */

function VersionsPanel({ prompts, onEdit, onMakeLive, livePending }) {
  const rows = [...prompts].reverse();
  const live = prompts.find((p) => p.is_live);
  return (
    <Panel
      className="dash-span-main"
      title="Prompt versions"
      aside={
        prompts.length > 0 && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onEdit(live ?? rows[0])}>
            New version
          </button>
        )
      }
    >
      {rows.length === 0 ? (
        <Empty>No versions saved yet.</Empty>
      ) : (
        <div className="dash-table-scroll">
          <table className="dash-table studio-versions">
            <thead>
              <tr>
                <th scope="col">Version</th>
                <th scope="col">Temp</th>
                <th scope="col">Format ex.</th>
                <th scope="col">👍</th>
                <th scope="col">👎</th>
                <th scope="col">✏️</th>
                <th scope="col">Good</th>
                <th scope="col" title="👍 share of rated names the model made itself; code swaps don't count">
                  AI good
                </th>
                <th scope="col">Saved</th>
                <th scope="col" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {rows.map((prompt) => {
                const r = prompt.ratings;
                return (
                  <tr key={prompt.id} className={prompt.is_live ? "is-live" : ""}>
                    <th scope="row">
                      <span className="studio-version">
                        <b>{versionName(prompt)}</b>
                        {prompt.is_live && <span className="studio-live">Live</span>}
                        {prompt.label && <span className="studio-version-label">{prompt.label}</span>}
                      </span>
                    </th>
                    <td>{fmtDec(prompt.temperature, 2)}</td>
                    <td>{prompt.example_count}</td>
                    <td className={r.good ? "" : "is-zero"}>{fmt(r.good)}</td>
                    <td className={r.bad ? "" : "is-zero"}>{fmt(r.bad)}</td>
                    <td className={r.fixed ? "" : "is-zero"}>{fmt(r.fixed)}</td>
                    <td>{fmtPct(ratio(r.good, ratedTotal(r)))}</td>
                    <td className="is-strong">{fmtPct(ratio(r.model_good ?? 0, r.model_rated ?? 0))}</td>
                    <td>
                      <Ago iso={prompt.created_at} />
                    </td>
                    <td>
                      <span className="studio-row-actions">
                        <button type="button" className="studio-link" onClick={() => onEdit(prompt)}>
                          Edit as new
                        </button>
                        {!prompt.is_live && (
                          <button
                            type="button"
                            className="studio-link is-strong"
                            disabled={livePending}
                            onClick={() => onMakeLive(prompt)}
                          >
                            Make live
                          </button>
                        )}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="dash-note">
        Versions never change once saved, so every rating points at the exact prompt that made the name.
        Good = 👍 share of all rated names. AI good leaves out code swaps, so it measures the prompt
        itself.
      </p>
    </Panel>
  );
}

function PromptEditor({ draft, base, onSave, onCancel }) {
  const [values, setValues] = useState(draft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const set = (key) => (event) => setValues((current) => ({ ...current, [key]: event.target.value }));

  const temperature = Number(values.temperature);
  const exampleCount = Number(values.exampleCount);
  const systemPrompt = values.systemPrompt.trim();
  const unchanged =
    base &&
    systemPrompt === base.system_prompt.trim() &&
    temperature === Number(base.temperature) &&
    exampleCount === Number(base.example_count);
  const invalid =
    !systemPrompt ||
    !(temperature >= 0 && temperature <= 2) ||
    !(Number.isInteger(exampleCount) && exampleCount >= 0 && exampleCount <= MAX_EXAMPLE_COUNT);

  // What the model server will spend on this version, so a long prompt doesn't silently time out.
  const promptTokens = Math.ceil(values.systemPrompt.length / 4);
  const exampleTokens = (Number.isFinite(exampleCount) ? exampleCount : 0) * TOKENS_PER_EXAMPLE;
  const readTokens = promptTokens + exampleTokens + USER_MESSAGE_TOKENS;
  const estimate = Math.round(readTokens / READ_TOKENS_PER_SECOND + REPLY_SECONDS);

  const submit = async (event) => {
    event.preventDefault();
    if (saving || invalid || unchanged) return;
    setSaving(true);
    setError(null);
    try {
      await onSave({ label: values.label.trim(), systemPrompt, temperature, exampleCount });
    } catch (failure) {
      setError(failure.message);
      setSaving(false);
    }
  };

  return (
    <Panel
      className="studio-editor"
      title={base ? `New version from ${versionName(base)}` : "First prompt version"}
      sub="Saves as the next version. It only reaches members once you make it live."
      aside={
        onCancel && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
            Close
          </button>
        )
      }
    >
      <form className="studio-editor-form" onSubmit={submit}>
        <div className="studio-editor-row">
          <label className="studio-field is-grow">
            <span>What changed</span>
            <input
              className="studio-input"
              type="text"
              value={values.label}
              maxLength={MAX_LABEL_LENGTH}
              placeholder="Stricter sound-swap rule"
              onChange={set("label")}
            />
          </label>
          <label className="studio-field">
            <span>Temperature {fmtDec(temperature, 2)}</span>
            <input
              className="studio-range"
              type="range"
              min="0"
              max="2"
              step="0.05"
              value={values.temperature}
              onChange={set("temperature")}
            />
          </label>
          <label className="studio-field">
            <span>Format examples per roll</span>
            <input
              className="studio-input studio-number"
              type="number"
              min="0"
              max={MAX_EXAMPLE_COUNT}
              step="1"
              value={values.exampleCount}
              onChange={set("exampleCount")}
            />
          </label>
        </div>
        <label className="studio-field">
          <span>
            System prompt · {"{count}"} = lines asked for ({api.BATCH_SIZE}) · {fmt(values.systemPrompt.length)} chars
          </span>
          <textarea
            className="studio-input studio-textarea"
            value={values.systemPrompt}
            rows={14}
            maxLength={8000}
            spellCheck="false"
            onChange={set("systemPrompt")}
          />
        </label>
        <p className={`studio-cost${estimate > MODEL_CUTOFF_SECONDS - 5 ? " is-warn" : ""}`}>
          ≈ {fmt(promptTokens)} tokens of prompt + {fmt(exampleTokens)} of format examples + ~{USER_MESSAGE_TOKENS} of
          theme and used names → about <b>{estimate} s</b> per batch on the model server (it reads ~
          {READ_TOKENS_PER_SECOND} tokens a second, then writes for ~{REPLY_SECONDS} s).
          {estimate > MODEL_CUTOFF_SECONDS - 5 && ` Batches are cut off at ${MODEL_CUTOFF_SECONDS} s: trim it.`}
        </p>
        {error && (
          <p className="dash-banner is-error" role="alert">
            {error}
          </p>
        )}
        <div className="studio-editor-actions">
          <p className="dash-note">
            {unchanged
              ? "Change the prompt, temperature or example count to save a new version."
              : invalid
                ? `Needs a prompt, a temperature from 0 to 2 and 0–${MAX_EXAMPLE_COUNT} examples.`
                : base
                  ? `Changes vs ${versionName(base)} are saved as a new version.`
                  : ""}
          </p>
          <button type="submit" className="btn btn-acid btn-sm" disabled={saving || invalid || unchanged}>
            {saving ? "Saving…" : "Save version"}
          </button>
        </div>
      </form>
    </Panel>
  );
}

/* ---------- example pool ---------- */

/**
 * The hand-typed "Original → BORG name" form. The ref's `fill({ name, original })` puts a name
 * picked from the board in it and moves to the original, which board names often lack.
 */
const AddExample = forwardRef(function AddExample({ onAdd }, ref) {
  const [original, setOriginal] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const originalRef = useRef(null);
  const ready = original.trim() && api.FUSED_BORG.test(name);

  useImperativeHandle(ref, () => ({
    fill(pick) {
      setName(pick.name);
      setOriginal(pick.original ?? "");
      setError(null);
      originalRef.current?.focus();
    },
  }));

  const submit = async (event) => {
    event.preventDefault();
    if (!ready || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onAdd({ original: original.trim(), name: name.trim() });
      setOriginal("");
      setName("");
    } catch (failure) {
      setError(failure.message);
    }
    setSaving(false);
  };

  return (
    <form className="studio-add-example" onSubmit={submit}>
      <input
        ref={originalRef}
        className="studio-input"
        type="text"
        value={original}
        maxLength={80}
        placeholder="Original"
        aria-label="Original"
        onChange={(event) => setOriginal(event.target.value)}
      />
      <span aria-hidden="true">→</span>
      <input
        className="studio-input"
        type="text"
        value={name}
        maxLength={80}
        placeholder="BORG name"
        aria-label="BORG name"
        onChange={(event) => setName(event.target.value)}
      />
      <button type="submit" className="btn btn-ghost btn-sm" disabled={!ready || saving}>
        {saving ? "Adding…" : "Add"}
      </button>
      {error && (
        <p className="studio-row-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
});

const BOARD_SOURCES = {
  ai: ["AI", "A BORG AI name rated 👍 or ✏️ fixed in the Studio, with the original it riffs on"],
  member: ["Member", "Sent in by a member and approved; members only send the name"],
  classic: ["Classic", "One of the site's own names"],
};
/** Board names listed at once; searching narrows the rest down. */
const BOARD_SHOWN = 40;

/**
 * Names already on the board that aren't in the example pool. One with a known original goes
 * straight in; one without fills the form so only the original needs typing.
 */
function BoardPicker({ board, error, exampleKeys, onAdd, onFill }) {
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("all");
  const [pending, setPending] = useState([]);
  const [addError, setAddError] = useState(null);
  const open = board.filter((row) => !exampleKeys.has(row.key));
  const needle = query.trim().toLowerCase();
  const matches = open.filter(
    (row) =>
      (source === "all" || row.source === source) &&
      (!needle || row.name.toLowerCase().includes(needle) || row.original?.toLowerCase().includes(needle))
  );
  const shown = matches.slice(0, BOARD_SHOWN);
  const count = (key) => open.filter((row) => row.source === key).length;

  const pick = async (row) => {
    setAddError(null);
    if (!row.original) {
      onFill(row);
      return;
    }
    setPending((current) => [...current, row.key]);
    try {
      await onAdd({ original: row.original, name: row.name });
    } catch (failure) {
      setAddError(`Couldn't add ${row.name}: ${failure.message}`);
    }
    setPending((current) => current.filter((key) => key !== row.key));
  };

  return (
    <section className="studio-board" aria-label="Quick add from the board">
      <div className="studio-board-head">
        <input
          className="studio-input"
          type="search"
          value={query}
          maxLength={80}
          placeholder={`Search: ${fmt(open.length)} names`}
          aria-label="Search board names"
          onChange={(event) => setQuery(event.target.value)}
        />
        <Seg
          label="Board names from"
          value={source}
          onChange={setSource}
          options={[
            { key: "all", label: "All" },
            ...Object.entries(BOARD_SOURCES).map(([key, [label]]) => ({ key, label: `${label} ${fmt(count(key))}` })),
          ]}
        />
      </div>
      {error && (
        <p className="studio-row-error" role="alert">
          Couldn't load member and AI names ({error}). Showing the classics.
        </p>
      )}
      {addError && (
        <p className="studio-row-error" role="alert">
          {addError}
        </p>
      )}
      {shown.length === 0 ? (
        <p className="studio-board-note">
          {open.length ? "No board names match." : "Every board name is already in the pool."}
        </p>
      ) : (
        <ol className="dash-list studio-board-list">
          {shown.map((row) => {
            const [label, title] = BOARD_SOURCES[row.source];
            return (
              <li key={row.key} className="dash-row">
                <div className="dash-row-main">
                  <p className="dash-row-name">{row.name}</p>
                  <p className="dash-row-meta">
                    <span className={row.original ? "" : "is-guest"}>{row.original ?? "No original yet"}</span>
                    <span className={`studio-source is-board-${row.source}`} title={title}>
                      {label}
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  className={`studio-link${row.original ? " is-strong" : ""}`}
                  disabled={pending.includes(row.key)}
                  title={row.original ? "Add to the example pool" : "Put it in the form above and type its original"}
                  onClick={() => pick(row)}
                >
                  {row.original ? "⭐ Add" : "Fill in"}
                </button>
              </li>
            );
          })}
        </ol>
      )}
      {matches.length > shown.length && (
        <p className="studio-board-note">
          {fmt(matches.length - shown.length)} more: search to narrow them down.
        </p>
      )}
    </section>
  );
}

function ExamplePool({ examples, exampleKeys, board, boardError, live, onToggle, onAdd }) {
  const formRef = useRef(null);
  const [filter, setFilter] = useState("all");
  const [pending, setPending] = useState([]);
  const on = examples.filter((e) => e.enabled).length;
  const rows = examples.filter((e) => (filter === "all" ? true : filter === "on" ? e.enabled : !e.enabled));

  const toggle = async (example) => {
    setPending((current) => [...current, example.id]);
    await onToggle(example);
    setPending((current) => current.filter((id) => id !== example.id));
  };

  return (
    <Panel
      className="dash-span-side"
      title={`Example pool (${fmt(on)})`}
      aside={
        <Seg
          label="Filter examples"
          value={filter}
          onChange={setFilter}
          options={[
            { key: "all", label: "All" },
            { key: "on", label: "On" },
            { key: "off", label: "Off" },
          ]}
        />
      }
    >
      <AddExample ref={formRef} onAdd={onAdd} />
      <BoardPicker
        board={board}
        error={boardError}
        exampleKeys={exampleKeys}
        onAdd={onAdd}
        onFill={(row) => formRef.current?.fill(row)}
      />
      {rows.length === 0 ? (
        <Empty>{examples.length ? "Nothing in this filter." : "No examples yet. ⭐ a name or add one above."}</Empty>
      ) : (
        <ol className="dash-list studio-pool">
          {rows.map((example) => (
            <li key={example.id} className={`dash-row${example.enabled ? "" : " is-off"}`}>
              <button
                type="button"
                role="switch"
                className="studio-switch"
                aria-checked={example.enabled}
                aria-label={`Use ${example.name} as an example`}
                disabled={pending.includes(example.id)}
                onClick={() => toggle(example)}
              />
              <div className="dash-row-main">
                <p className="dash-row-name">{example.name}</p>
                <p className="dash-row-meta">
                  {example.original}
                  {example.source ? ` · ${example.source}` : ""}
                </p>
              </div>
              <span className="dash-row-time">
                <Ago iso={example.created_at} />
              </span>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

/* ---------- ratings log ---------- */

function RatingsLog({ ratings, prompts }) {
  const [verdict, setVerdict] = useState("all");
  const [promptId, setPromptId] = useState("all");
  const byId = useMemo(() => new Map(prompts.map((p) => [String(p.id), p])), [prompts]);
  const rows = ratings.filter(
    (r) => (verdict === "all" || r.verdict === verdict) && (promptId === "all" || String(r.prompt_id) === promptId)
  );

  return (
    <Panel
      className="dash-span-full"
      title="Ratings"
      sub={`${fmt(rows.length)} of the latest ${fmt(ratings.length)} ratings`}
      aside={
        <div className="dash-controls">
          <label className="studio-field is-inline">
            <span>Version</span>
            <select className="studio-input" value={promptId} onChange={(event) => setPromptId(event.target.value)}>
              <option value="all">All</option>
              {[...prompts].reverse().map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {versionLabel(p)}
                </option>
              ))}
            </select>
          </label>
          <Seg
            label="Filter by verdict"
            value={verdict}
            onChange={setVerdict}
            options={[
              { key: "all", label: "All" },
              ...Object.entries(VERDICTS).map(([key, v]) => ({ key, label: v.icon })),
            ]}
          />
        </div>
      }
    >
      {rows.length === 0 ? (
        <Empty>{ratings.length ? "No ratings match." : "Nothing rated yet. Generate a batch and rate it."}</Empty>
      ) : (
        <div className="dash-table-scroll">
          <table className="dash-table studio-log">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Made by</th>
                <th scope="col">Original</th>
                <th scope="col">Verdict</th>
                <th scope="col">Reason / fix</th>
                <th scope="col">Theme</th>
                <th scope="col">Version</th>
                <th scope="col">When</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <th scope="row" className="studio-log-name">
                    {r.name}
                  </th>
                  <td>
                    <SourceChip source={r.source} />
                    {!r.source && <span className="is-zero">—</span>}
                  </td>
                  <td>{r.original}</td>
                  <td>
                    <span className={`studio-chip is-${r.verdict}`}>
                      {VERDICTS[r.verdict]?.icon} {VERDICTS[r.verdict]?.label ?? r.verdict}
                    </span>
                  </td>
                  <td className="studio-log-why">
                    {r.fixed_name && <b>→ {r.fixed_name}</b>}
                    {r.fixed_name && r.reason ? " · " : ""}
                    {r.reason}
                    {!r.fixed_name && !r.reason && <span className="is-zero">—</span>}
                  </td>
                  <td className={r.theme ? "" : "is-zero"}>{r.theme || "random"}</td>
                  <td>{versionName(byId.get(String(r.prompt_id)))}</td>
                  <td>
                    <Ago iso={r.created_at} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

/* ---------- member feedback ---------- */

function MemberFeedback({ rows, exampleKeys, onStar }) {
  const [order, setOrder] = useState("disliked");
  const [pending, setPending] = useState([]);
  const [error, setError] = useState(null);
  const sorted = [...rows].sort((a, b) =>
    order === "disliked" ? b.dislikes - a.dislikes || a.likes - b.likes : b.likes - a.likes || a.dislikes - b.dislikes
  );
  const totals = rows.reduce(
    (sum, r) => {
      const key = r.source ?? "unknown";
      sum[key] = sum[key] ?? { likes: 0, dislikes: 0 };
      sum[key].likes += r.likes;
      sum[key].dislikes += r.dislikes;
      return sum;
    },
    {}
  );
  const share = (key) =>
    totals[key] ? fmtPct(ratio(totals[key].likes, totals[key].likes + totals[key].dislikes)) : "—";

  const star = async (row) => {
    setPending((current) => [...current, row.name]);
    setError(null);
    try {
      await onStar({ original: row.original, name: row.name });
    } catch (failure) {
      setError(`Couldn't add ${row.name}: ${failure.message}`);
    }
    setPending((current) => current.filter((name) => name !== row.name));
  };

  return (
    <Panel
      className="dash-span-full"
      title="Member feedback"
      sub={`Live BORG AI names from the last 30 days that members ❤️ or 👎 · liked share: AI ${share("model")} · code ${share("code")}`}
      aside={
        <Seg
          label="Sort feedback"
          value={order}
          onChange={setOrder}
          options={[
            { key: "disliked", label: "Most 👎" },
            { key: "liked", label: "Most ❤️" },
          ]}
        />
      }
    >
      {error && (
        <p className="dash-banner is-error" role="alert">
          {error}
        </p>
      )}
      {sorted.length === 0 ? (
        <Empty>No member reactions to BORG AI names yet.</Empty>
      ) : (
        <div className="dash-table-scroll">
          <table className="dash-table studio-log">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Made by</th>
                <th scope="col">Original</th>
                <th scope="col">❤️</th>
                <th scope="col">👎</th>
                <th scope="col">Rolls</th>
                <th scope="col">Last rolled</th>
                <th scope="col" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const inPool = exampleKeys.has(api.nameKey(r.name));
                return (
                  <tr key={r.name}>
                    <th scope="row" className="studio-log-name">
                      {r.name}
                    </th>
                    <td>
                      <SourceChip source={r.source} />
                      {!r.source && <span className="is-zero">—</span>}
                    </td>
                    <td className={r.original ? "" : "is-zero"}>{r.original ?? "—"}</td>
                    <td className={r.likes ? "" : "is-zero"}>{fmt(r.likes)}</td>
                    <td className={r.dislikes ? "" : "is-zero"}>{fmt(r.dislikes)}</td>
                    <td>{fmt(r.rolls)}</td>
                    <td>
                      <Ago iso={r.last_rolled_at} />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="studio-link is-strong"
                        disabled={inPool || !r.original || pending.includes(r.name)}
                        title={
                          inPool ? "Already in the example pool" : r.original ? "Add to the example pool" : "No original recorded"
                        }
                        onClick={() => star(r)}
                      >
                        {inPool ? "In pool" : "⭐ Example"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

/* ---------- fine-tuning data ---------- */

function download(filename, lines) {
  const url = URL.createObjectURL(new Blob([`${lines.join("\n")}\n`], { type: "application/jsonl" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: filename });
  link.click();
  URL.revokeObjectURL(url);
}

const ORIGINS = [
  ["fixed", "✏️ fixed"],
  ["good", "👍 rated"],
  ["liked", "❤️ by members"],
  ["example", "example pool"],
];

/**
 * Turns everything rated so far into fine-tuning files, read fresh on demand because it reads
 * every rating, not the latest 200. Training itself happens offline (training/README.md).
 */
function TrainingData({ prompt }) {
  const [state, setState] = useState({ status: "idle", files: null, error: null });

  const build = async () => {
    setState((current) => ({ ...current, status: "loading", error: null }));
    try {
      const source = await api.fetchTrainingData();
      const pairs = trainingPairs(source);
      setState({
        status: "ready",
        error: null,
        files: {
          pairs,
          sft: sftLines(pairs, prompt.system_prompt),
          dpo: dpoLines(source.ratings, prompt.system_prompt),
        },
      });
    } catch (failure) {
      setState((current) => ({ ...current, status: "error", error: failure.message }));
    }
  };

  const { status, files, error } = state;
  const stamp = new Date().toISOString().slice(0, 10);
  const count = files?.pairs.length ?? 0;

  return (
    <Panel
      className="dash-span-full"
      title="Fine-tuning data"
      sub={`Everything rated so far as training files, with ${versionLabel(prompt)} as the system prompt · training runs offline, see training/README.md`}
      aside={
        <button type="button" className="btn btn-ghost btn-sm" onClick={build} disabled={status === "loading"}>
          {status === "loading" ? "Building…" : files ? "Rebuild" : "Build training files"}
        </button>
      }
    >
      {error && (
        <p className="dash-banner is-error" role="alert">
          Couldn't read the training data: {error}
        </p>
      )}
      {!files ? (
        <Empty>
          Builds from every 👍 and ✏️ rating, live names members liked and the example pool. A LoRA run starts
          paying off around {fmt(TRAINING_TARGET)} pairs.
        </Empty>
      ) : (
        <>
          <div className="studio-meter" role="img" aria-label={`${count} of ${TRAINING_TARGET} pairs`}>
            <span style={{ width: `${Math.min(100, (count / TRAINING_TARGET) * 100)}%` }} />
          </div>
          <p className="studio-run-stats">
            <span>
              <b>{fmt(count)}</b> / {fmt(TRAINING_TARGET)} pairs
            </span>
            {ORIGINS.map(([key, label]) => (
              <span key={key}>
                <b>{fmt(files.pairs.filter((p) => p.origin === key).length)}</b> {label}
              </span>
            ))}
            <span>
              <b>{fmt(files.dpo.length)}</b> {files.dpo.length === 1 ? "fix pair" : "fix pairs"}
            </span>
          </p>
          <div className="studio-downloads">
            <button
              type="button"
              className="btn btn-acid btn-sm"
              disabled={!files.sft.length}
              onClick={() => download(`borg-sft-${stamp}.jsonl`, files.sft)}
            >
              Download SFT · {fmt(files.sft.length)} {files.sft.length === 1 ? "chat" : "chats"}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={!files.dpo.length}
              onClick={() => download(`borg-dpo-${stamp}.jsonl`, files.dpo)}
            >
              Download DPO · {fmt(files.dpo.length)} {files.dpo.length === 1 ? "pair" : "pairs"}
            </button>
          </div>
          <p className="dash-note">
            SFT teaches the reply format with your best names, batched by theme like a real roll. DPO teaches each ✏️
            fix over the name the model wrote. Names whose latest rating is 👎 are left out.
            {count < TRAINING_TARGET &&
              ` Under ${fmt(TRAINING_TARGET)} pairs a LoRA mostly memorises these names: keep rating.`}
          </p>
        </>
      )}
    </Panel>
  );
}

/* ---------- tab ---------- */

export default function Studio() {
  const [state, setState] = useState({ status: "loading", data: null, error: null });
  const [notice, setNotice] = useState(null);
  const [draft, setDraft] = useState(null);
  const [livePending, setLivePending] = useState(false);
  const latest = useRef(0);
  const editorRef = useRef(null);

  const load = useCallback(async () => {
    const id = ++latest.current;
    setState((current) => ({ ...current, status: "loading" }));
    let next;
    let error;
    try {
      next = await api.fetchStudio();
    } catch (failure) {
      error = failure;
    }
    if (id !== latest.current) return;
    setState((current) =>
      error ? { ...current, status: "error", error: error.message } : { status: "ready", data: next, error: null }
    );
  }, []);

  useEffect(() => {
    load();
    return () => {
      latest.current += 1;
    };
  }, [load]);

  useEffect(() => {
    if (draft) editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [draft]);

  const patch = (update) => setState((current) => (current.data ? { ...current, data: update(current.data) } : current));

  const makeLive = async (prompt) => {
    if (!window.confirm(`Make ${versionName(prompt)} live? Every BORG AI roll uses it from the next request.`)) return;
    setLivePending(true);
    try {
      await api.setLivePrompt(prompt.id);
      patch((d) => ({ ...d, prompts: d.prompts.map((p) => ({ ...p, is_live: p.id === prompt.id })) }));
      setNotice({ tone: "ok", text: `${versionName(prompt)} is live.` });
    } catch (failure) {
      setNotice({ tone: "error", text: `Couldn't make ${versionName(prompt)} live: ${failure.message}` });
    }
    setLivePending(false);
  };

  const savePrompt = async (values) => {
    const prompt = await api.savePrompt(values);
    patch((d) => ({ ...d, prompts: [...d.prompts, { ...prompt, ratings: prompt.ratings ?? NO_RATINGS }] }));
    setDraft(null);
    setNotice({ tone: "ok", text: `Saved ${versionName(prompt)}. Try it in the playground, then make it live.` });
  };

  const rate = async (input, prior) => {
    const rating = await api.rateName(input);
    patch((d) => ({
      ...d,
      ratings: prior ? d.ratings.map((r) => (r.id === rating.id ? rating : r)) : [rating, ...d.ratings],
      prompts: d.prompts.map((p) => {
        if (p.id !== rating.prompt_id) return p;
        const counts = { ...NO_RATINGS, ...p.ratings };
        const count = (r, step) => {
          counts[r.verdict] += step;
          if (r.source !== "model") return;
          counts.model_rated += step;
          if (r.verdict === "good") counts.model_good += step;
        };
        if (prior) count(prior, -1);
        count(rating, 1);
        return { ...p, ratings: counts };
      }),
    }));
    return rating;
  };

  // add_borg_example switches an existing pool entry back on instead of duplicating it.
  const star = async (pair) => {
    const example = await api.addExample(pair);
    patch((d) => ({ ...d, examples: [example, ...d.examples.filter((e) => e.id !== example.id)] }));
  };

  const toggleExample = async (example) => {
    try {
      await api.setExampleEnabled(example.id, !example.enabled);
      patch((d) => ({
        ...d,
        examples: d.examples.map((e) => (e.id === example.id ? { ...e, enabled: !example.enabled } : e)),
      }));
    } catch (failure) {
      setNotice({ tone: "error", text: `Couldn't switch ${example.name}: ${failure.message}` });
    }
  };

  const { status, data, error } = state;
  const prompts = data?.prompts ?? [];
  const live = prompts.find((p) => p.is_live) ?? null;
  // Training data uses the prompt members get: the live version, else the newest.
  const trainingPrompt = live ?? prompts[prompts.length - 1] ?? null;
  const exampleKeys = useMemo(() => new Set((data?.examples ?? []).map((e) => api.nameKey(e.name))), [data]);
  const editorDraft = draft ?? (data && prompts.length === 0 ? BLANK_DRAFT : null);
  const editorBase = editorDraft && prompts.find((p) => p.id === editorDraft.baseId);

  return (
    <>
      <div className="dash-head">
        <div>
          <h1 className="dash-title">Studio.</h1>
        </div>
        <div className="dash-controls">
          <button
            type="button"
            className="btn btn-acid btn-sm dash-refresh"
            onClick={load}
            disabled={status === "loading"}
          >
            {status === "loading" ? "Loading…" : "Refresh"}
          </button>
        </div>
      </div>

      {notice && (
        <div className={`dash-banner ${notice.tone === "error" ? "is-error" : "is-quiet"}`} role="status">
          <span>{notice.text}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setNotice(null)}>
            Dismiss
          </button>
        </div>
      )}

      {status === "error" && data && (
        <div className="dash-banner is-error" role="alert">
          <span>Couldn't refresh ({error}). Showing what was loaded before.</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={load}>
            Retry
          </button>
        </div>
      )}

      {data ? (
        <div className={`dash-body${status === "loading" ? " is-loading" : ""}`} aria-busy={status === "loading"}>
          <div className="dash-grid">
            <Playground
              prompts={prompts}
              exampleKeys={exampleKeys}
              onRate={rate}
              onStar={star}
              onMakeLive={makeLive}
              livePending={livePending}
            />
            <VersionsPanel
              prompts={prompts}
              onEdit={(prompt) => setDraft(draftFrom(prompt))}
              onMakeLive={makeLive}
              livePending={livePending}
            />
            <ExamplePool
              examples={data.examples}
              exampleKeys={exampleKeys}
              board={data.board}
              boardError={data.boardError}
              live={live}
              onToggle={toggleExample}
              onAdd={star}
            />
            {editorDraft && (
              <div ref={editorRef} className="dash-span-full">
                <PromptEditor
                  key={`${editorDraft.baseId}-${prompts.length}`}
                  draft={editorDraft}
                  base={editorBase}
                  onSave={savePrompt}
                  onCancel={draft && (() => setDraft(null))}
                />
              </div>
            )}
            {data.feedbackError ? (
              <p className="dash-banner is-error dash-span-full" role="alert">
                Couldn't load member feedback: {data.feedbackError}
              </p>
            ) : (
              <MemberFeedback rows={data.feedback} exampleKeys={exampleKeys} onStar={star} />
            )}
            <RatingsLog ratings={data.ratings} prompts={prompts} />
            {trainingPrompt && <TrainingData prompt={trainingPrompt} />}
          </div>
        </div>
      ) : status === "error" ? (
        <div className="dash-failed" role="alert">
          <p className="dash-panel-title">Couldn't load the studio.</p>
          <p className="dash-note">{error}</p>
          <button type="button" className="btn btn-acid btn-sm" onClick={load}>
            Try again
          </button>
        </div>
      ) : (
        <div className="dash-skeleton" role="status" aria-label="Loading studio">
          <div className="dash-skeleton-main">
            <span />
            <span />
          </div>
          <p className="dash-skeleton-text">Warming up the studio…</p>
        </div>
      )}
    </>
  );
}
