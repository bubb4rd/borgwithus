import React, { useState } from "react";
import data from "../data.json";
import { useBorgs } from "../context/BorgsContext";
import { supabase } from "../lib/supabase";
import LikeButton from "./LikeButton";

// Never hand back the value already on screen, so every click visibly changes.
function pickDifferent(list, current) {
  if (list.length < 2) return list[0];
  let next = current;
  while (next === current) next = list[Math.floor(Math.random() * list.length)];
  return next;
}

// Counts the roll for the admin dashboard. Fire and forget: stats never block the generator.
function logRoll(kind, name) {
  supabase?.rpc("log_borg_roll", { p_kind: kind, p_name: name }).then(() => {});
}

export default function Borg() {
  const { names } = useBorgs();
  const [name, setName] = useState(null);
  const [flavour, setFlavour] = useState(null);

  const rollName = () => {
    if (!names.length) return;
    const next = pickDifferent(names, name);
    setName(next);
    logRoll("borg", next);
  };
  const rollFlavour = () => {
    const next = pickDifferent(data.mio, flavour);
    setFlavour(next);
    logRoll("mio", next.name);
  };
  const rollBoth = () => {
    rollName();
    rollFlavour();
  };

  return (
    <section id="borg" className="gen-card grain">
      <div className="gen-intro">
        <h2 className="display">Let's borg</h2>
        <p className="gen-copy">
          Every borg needs a name and a flavour. Roll until it feels right, then Sharpie it on the
          jug.
        </p>
        <p className="gen-disclaimer">Please drink responsibly.</p>
      </div>

      <div className="label">
        <div className="label-tape" aria-hidden="true" />
        <div className="label-row" aria-live="polite">
          <span className="label-key">This borg is called</span>
          <div className="label-result">
            <p key={name ?? "empty"} className={`label-name ${name ? "is-set" : "is-empty"}`}>
              {name ?? "Hit BORG!"}
            </p>
            {name && <LikeButton name={name} from="/#borg" />}
          </div>
        </div>
        <div className="label-row" aria-live="polite">
          <span className="label-key">Flavoured with</span>
          <p
            key={flavour?.name ?? "empty"}
            className={`label-flavour ${flavour ? "is-set" : "is-empty"}`}
            style={flavour ? { "--flavour": flavour.color } : undefined}
          >
            {flavour ? `Mio ${flavour.name}` : "Hit MIO"}
          </p>
        </div>
        <div className="label-actions">
          <button type="button" className="btn btn-ink" onClick={rollName}>BORG!</button>
          <button type="button" className="btn btn-ink-ghost" onClick={rollFlavour}>MIO</button>
          <button type="button" className="btn btn-blue" onClick={rollBoth}>Both</button>
        </div>
      </div>
    </section>
  );
}
