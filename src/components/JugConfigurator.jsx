import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import data from "../data.json";
import { useAuth } from "../context/AuthContext";
import { useBorgs } from "../context/BorgsContext";
import { logGeneratorEvent, logRoll } from "../lib/generatorExperiment";
import {
  CLEAR,
  drawScene,
  loadFlavourPhoto,
  loadJugAssets,
  renderJugImage,
  SCENE,
} from "../lib/jugRenderer";
import useBorgAi from "../lib/useBorgAi";
import { CreditPips, MAX_THEME_LENGTH } from "./AiGenerator";
import { pickDifferent } from "./Borg";
import { useBorgAiBeta } from "./BorgAiLabel";
import DislikeButton from "./DislikeButton";
import LikeButton from "./LikeButton";
import "./JugConfigurator.css";

// The "jug" side of the generator A/B test (src/lib/generatorExperiment.js): roll a classic name
// or ask BORG AI for one, pick or roll a MiO, and watch both land on the jug, then save or share it.

const POUR_MS = 1100;
const WRITE_MS_PER_CHAR = 55;
const WRITE_MS_MAX = 1600;

const easeOut = (t) => 1 - (1 - t) ** 3;

function reducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

function fileName(name) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug || "my-borg"}.jpg`;
}

// The jug on a canvas sized to its box, redrawn every frame while the MiO pours or the name is
// being written, and idle otherwise.
function JugCanvas({ assets, name, flavour }) {
  const canvasRef = useRef(null);
  // The preview leaves off the saved image's corner marks; the photo fills its frame instead.
  const frame = useRef({ from: CLEAR, to: CLEAR, pour: 1, name: null, write: 1, flavour: null, marks: false });
  const timing = useRef({ pourStart: null, writeStart: null, writeMs: 0 });
  const raf = useRef(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !assets) return;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(canvas.width / SCENE.width, 0, 0, canvas.height / SCENE.height, 0, 0);
    drawScene(ctx, assets, frame.current);
  }, [assets]);

  const tick = useCallback(() => {
    const now = performance.now();
    const f = frame.current;
    const t = timing.current;
    f.pour = t.pourStart === null ? 1 : easeOut(Math.min(1, (now - t.pourStart) / POUR_MS));
    f.write = t.writeStart === null ? 1 : Math.min(1, (now - t.writeStart) / t.writeMs);
    draw();
    raf.current = f.pour < 1 || f.write < 1 ? requestAnimationFrame(tick) : null;
  }, [draw]);

  const animate = useCallback(() => {
    if (!raf.current) raf.current = requestAnimationFrame(tick);
  }, [tick]);

  useEffect(() => () => raf.current && cancelAnimationFrame(raf.current), []);

  // The canvas covers its box (object-fit: cover), so size the backing store for whichever side
  // the scene has to fill, at the screen's pixel ratio, capped at the scene size.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      const cover = Math.max(canvas.clientWidth, (canvas.clientHeight * SCENE.width) / SCENE.height);
      const width = Math.min(SCENE.width, Math.round(cover * ratio));
      if (!width || width === canvas.width) return;
      canvas.width = width;
      canvas.height = Math.round((width * SCENE.height) / SCENE.width);
      draw();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [draw]);

  // Pour the new flavour in once its photo is loaded (they preload, so usually at once).
  useEffect(() => {
    if (!assets) return undefined;
    const f = frame.current;
    const next = flavour?.name ?? CLEAR;
    if (next === f.to) return undefined;
    let active = true;
    loadFlavourPhoto(assets, next).then(
      () => {
        if (!active) return;
        f.from = f.to;
        f.to = next;
        f.flavour = flavour?.name ?? null;
        timing.current.pourStart = reducedMotion() ? null : performance.now();
        animate();
      },
      (error) => console.error(error)
    );
    return () => {
      active = false;
    };
  }, [assets, flavour, animate]);

  useEffect(() => {
    const f = frame.current;
    if (name === f.name) return;
    f.name = name;
    const t = timing.current;
    t.writeMs = Math.min(WRITE_MS_MAX, (name?.length ?? 0) * WRITE_MS_PER_CHAR);
    t.writeStart = reducedMotion() || !name ? null : performance.now();
    animate();
  }, [name, animate]);

  // First paint once the images and fonts are in.
  useEffect(() => {
    draw();
  }, [draw]);

  const description = `A gallon jug${flavour ? ` of Mio ${flavour.name}` : " of clear water and vodka"}${
    name ? ` with "${name}" written on it in marker` : ""
  }.`;

  return <canvas ref={canvasRef} className="jug-canvas" role="img" aria-label={description} />;
}

function RerollIcon() {
  return (
    <svg className="jug-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
      <path d="M21 3v5h-5" />
    </svg>
  );
}

function DiceIcon() {
  return (
    <svg className="jug-icon" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <circle cx="8.5" cy="8.5" r="1" />
      <circle cx="15.5" cy="15.5" r="1" />
      <circle cx="15.5" cy="8.5" r="1" />
      <circle cx="8.5" cy="15.5" r="1" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg className="jug-icon jug-sparkle" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3c.6 4.2 2.8 6.4 7 7-4.2.6-6.4 2.8-7 7-.6-4.2-2.8-6.4-7-7 4.2-.6 6.4-2.8 7-7Z" />
      <path d="M19 15.5c.25 1.6 1 2.35 2.5 2.5-1.5.15-2.25.9-2.5 2.5-.25-1.6-1-2.35-2.5-2.5 1.5-.15 2.25-.9 2.5-2.5Z" />
    </svg>
  );
}

// What the Ask button says while BORG AI works, cycled like a chat app's status line (a request
// can take a while: up to three model batches).
// Eight letters at most, so Ask can hold the thinking state without changing width.
const THINKING_WORDS = ["Thinking", "Cooking", "Mixing", "Pouring"];
const THINKING_MS = 1800;

function ThinkingLabel() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reducedMotion()) return undefined;
    const id = setInterval(() => setIndex((i) => (i + 1) % THINKING_WORDS.length), THINKING_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="jug-thinking">
      <SparkleIcon />
      <span key={index} className="jug-thinking-word">
        {THINKING_WORDS[index]}
      </span>
    </span>
  );
}

// BORG AI inside the name step: a theme, then Ask with 👍/👎 for the name it gave, and today's
// credits under them. The thumbs are always there so members know they can rate; they stay
// greyed out until BORG AI has handed back a name (`aiName`), then pop in live.
function AiNameForm({ userId, aiName, onName }) {
  const [theme, setTheme] = useState("");
  const { credits, outOfCredits, loading, error, generate } = useBorgAi(userId);

  const onSubmit = async (event) => {
    event.preventDefault();
    const name = await generate(theme);
    if (name) onName(name);
  };

  return (
    <form className="jug-ai" onSubmit={onSubmit}>
      <div className="jug-ai-row">
        <input
          className="jug-input"
          type="text"
          value={theme}
          maxLength={MAX_THEME_LENGTH}
          placeholder="Theme (optional)"
          aria-label="BORG AI theme (optional)"
          onChange={(event) => setTheme(event.target.value)}
        />
        <div className="jug-ai-actions">
          {/* Not disabled while thinking, so the button keeps its full colour; useBorgAi
              ignores a second submit until the first one answers. */}
          <button
            type="submit"
            className={`btn btn-ghost jug-ai-btn${loading ? " is-thinking" : ""}`}
            disabled={outOfCredits}
            aria-busy={loading}
            aria-label={loading ? "BORG AI is thinking" : undefined}
          >
            {loading ? (
              <ThinkingLabel />
            ) : (
              <>
                <SparkleIcon />
                Ask
              </>
            )}
          </button>
          {/* Keyed by the name, so each new AI name remounts the pair and replays the pop. */}
          <span key={aiName ?? "none"} className={`jug-ai-rate${aiName ? " is-live" : ""}`}>
            <LikeButton name={aiName} from="/#borg" compact disabled={!aiName} />
            <DislikeButton name={aiName} compact disabled={!aiName} />
          </span>
        </div>
      </div>
      {credits && <CreditPips credits={credits} />}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

// Animates its height to fit its children, so content arriving late (auth, credits, an error) or
// swapping out (Classic/BORG AI) slides the panel instead of making it jump.
function AutoHeight({ children }) {
  const inner = useRef(null);
  const [height, setHeight] = useState(null);

  useLayoutEffect(() => {
    const node = inner.current;
    if (!node) return undefined;
    setHeight(node.offsetHeight);
    const observer = new ResizeObserver(() => setHeight(node.offsetHeight));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="jug-auto" style={height === null ? undefined : { height }}>
      <div ref={inner} className="jug-auto-inner">
        {children}
      </div>
    </div>
  );
}

export default function JugConfigurator() {
  const { names } = useBorgs();
  const { user, ready, online } = useAuth();
  const beta = useBorgAiBeta();
  const [assets, setAssets] = useState(null);
  const [assetError, setAssetError] = useState(false);
  // Which name maker the name step shows.
  const [source, setSource] = useState("classic");
  // { text, source: "classic" | "ai" }
  const [name, setName] = useState(null);
  const [flavour, setFlavour] = useState(null);
  // The finished image for the current name and MiO, made ahead of the click: Safari only opens the
  // share sheet when navigator.share() runs straight from the tap, with nothing awaited first.
  const [file, setFile] = useState(null);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    let active = true;
    loadJugAssets().then(
      (loaded) => active && setAssets(loaded),
      () => active && setAssetError(true)
    );
    return () => {
      active = false;
    };
  }, []);

  // Phones (and some desktops) can hand the image straight to the share sheet.
  useEffect(() => {
    try {
      const probe = new File([new Blob()], "borg.jpg", { type: "image/jpeg" });
      setCanShare(Boolean(navigator.canShare?.({ files: [probe] })));
    } catch {
      setCanShare(false);
    }
  }, []);

  const rollName = () => {
    if (!names.length) return;
    const next = pickDifferent(names, name?.source === "classic" ? name.text : null);
    setName({ text: next, source: "classic" });
    logRoll("borg", next);
  };
  // A tapped swatch and "Surprise me" both count as a MiO roll for the A/B test.
  const chooseFlavour = (next) => {
    if (next === flavour) return;
    setFlavour(next);
    logRoll("mio", next.name);
  };
  const surpriseFlavour = () => chooseFlavour(pickDifferent(data.mio, flavour));

  useEffect(() => {
    setFile(null);
    if (!assets || !name || !flavour) return undefined;
    let active = true;
    renderJugImage(assets, { name: name.text, flavour: flavour.name }).then(
      (blob) => active && setFile(new File([blob], fileName(name.text), { type: "image/jpeg" })),
      (error) => console.error(error)
    );
    return () => {
      active = false;
    };
  }, [assets, name, flavour]);

  const save = () => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    logGeneratorEvent("save");
  };

  const share = () => {
    if (!file) return;
    navigator.share({ files: [file], title: name.text }).then(
      () => logGeneratorEvent("share"),
      // Closing the share sheet isn't an error worth showing.
      (error) => error?.name !== "AbortError" && console.error(error)
    );
  };

  let aiControls = null;
  if (source === "ai" && ready) {
    aiControls = user ? (
      <AiNameForm
        userId={user.id}
        aiName={name?.source === "ai" ? name.text : null}
        onName={(text) => setName({ text, source: "ai" })}
      />
    ) : (
      <p className="jug-note">
        BORG AI cooks up names nobody's heard, five a day for members.{" "}
        <Link to="/register" state={{ from: "/#borg" }}>
          Sign up free
        </Link>{" "}
        or{" "}
        <Link to="/login" state={{ from: "/#borg" }}>
          log in
        </Link>
        .
      </p>
    );
  }

  return (
    <section
      id="borg"
      className={`jug-config${flavour ? " has-flavour" : ""}`}
      aria-labelledby="jug-title"
      style={{ "--flavour": flavour?.color ?? "var(--acid)" }}
    >
      <div className="jug-stage">
        <JugCanvas assets={assets} name={name?.text ?? null} flavour={flavour} />
        <span className={`jug-tag${flavour ? "" : " is-empty"}`}>
          <i aria-hidden="true" />
          {flavour ? `Mio ${flavour.name}` : "No Mio yet"}
        </span>
        {assetError && <p className="jug-stage-error">The jug didn't load. Refresh to try again.</p>}
      </div>

      <div className="jug-panel grain">
        <h2 id="jug-title" className="jug-title">
          Build your <em>borg</em>
        </h2>

        <div className="jug-step">
          <div className="jug-step-head">
            <span className="jug-step-label">Name it</span>
            {online && (
              <div className="jug-seg" role="group" aria-label="Where the name comes from" data-active={source}>
                <button type="button" aria-pressed={source === "classic"} onClick={() => setSource("classic")}>
                  Classic
                </button>
                <button type="button" aria-pressed={source === "ai"} onClick={() => setSource("ai")}>
                  BORG AI{" "}
                  <span className="jug-beta-badge">Beta</span>
                </button>
              </div>
            )}
          </div>
          {/* The borg's label: a darker well the name (or its placeholder) sits in. */}
          <div className="jug-name-well">
            <p
              key={name?.text ?? `empty-${source}`}
              className={`jug-name ${name ? "is-set" : "is-empty"}`}
              aria-live="polite"
            >
              {name?.text ?? (source === "ai" ? "Ask BORG AI" : "Roll a name")}
            </p>
          </div>
          <AutoHeight>
            {/* Keyed by source, so switching Classic/BORG AI fades the new controls in while the
                box glides to their height. */}
            <div key={source} className="jug-swap">
              {source === "classic" && (
                <div className="jug-name-actions">
                  <button type="button" className="jug-roll" onClick={rollName}>
                    <RerollIcon />
                    BORG!
                  </button>
                  {name && <LikeButton name={name.text} from="/#borg" compact />}
                  {name?.source === "ai" && <DislikeButton name={name.text} compact />}
                </div>
              )}
              {aiControls}
              {source === "ai" && (
                <button type="button" className="jug-link" aria-haspopup="dialog" onClick={beta.open}>
                  Learn more about BORG AI
                </button>
              )}
            </div>
          </AutoHeight>
        </div>

        <div className="jug-step">
          <div className="jug-step-head">
            <span className="jug-step-label">Dye it</span>
            <button type="button" className="jug-text-btn" onClick={surpriseFlavour}>
              <DiceIcon />
              Surprise me
            </button>
          </div>
          <div className="jug-swatches" role="group" aria-label="Mio flavour">
            {data.mio.map((option) => (
              <button
                key={option.name}
                type="button"
                className="jug-swatch"
                aria-pressed={flavour?.name === option.name}
                style={{ "--swatch": option.color }}
                onClick={() => chooseFlavour(option)}
              >
                <i aria-hidden="true" />
                <span>{option.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="jug-step">
          <div className="jug-step-head">
            <span className="jug-step-label">Keep it</span>
            <span className="jug-fine">Please drink responsibly</span>
          </div>
          <div className="jug-actions">
            <button type="button" className="btn btn-acid" onClick={save} disabled={!file}>
              Save image
            </button>
            {canShare && (
              <button type="button" className="btn btn-ghost" onClick={share} disabled={!file}>
                Share
              </button>
            )}
          </div>
          <AutoHeight>
            {!(name && flavour) && (
              <p className="jug-hint">
                {name ? "Pick a Mio" : flavour ? "Roll a name" : "Roll a name and pick a Mio"} to save
                your jug.
              </p>
            )}
          </AutoHeight>
        </div>
      </div>
      {beta.dialog}
    </section>
  );
}
