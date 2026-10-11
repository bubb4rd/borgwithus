import React, { useEffect, useState } from "react";
import jug from "../assets/borgwithus.png";
import { supabase } from "../lib/supabase";
import HeroShader from "./HeroShader";

// Borgs that reached the board in the last 7 days (get_borgs_added_this_week()); null until it
// answers, and for good without Supabase.
function useAddedThisWeek() {
  const [count, setCount] = useState(null);

  useEffect(() => {
    if (!supabase) return undefined;
    let active = true;
    supabase.rpc("get_borgs_added_this_week").then(({ data, error }) => {
      if (active && !error && typeof data === "number") setCount(data);
    });
    return () => {
      active = false;
    };
  }, []);

  return count;
}

export default function Home() {
  const added = useAddedThisWeek();

  return (
    <section id="home" className="hero">
      <div className="hero-card grain">
        <HeroShader />
        <div className="hero-stage">
          <h1 className="hero-title">
            <span className="hero-line hero-line-top">Borg</span>
            <span className="hero-line hero-line-bottom">with us</span>
          </h1>
          <img className="hero-jug" src={jug} alt="A gallon jug of blue BORG with a Borg With Us label" />
        </div>
        <div className="hero-foot">
          <div className="hero-intro">
            {added > 0 && (
              <a className="hero-sticker" href="#borg">
                <span className="hero-sticker-tape" aria-hidden="true" />
                <span className="hero-sticker-count">+{added}</span>
                <span className="hero-sticker-label">
                  {added === 1 ? "Borg" : "Borgs"} added this week
                </span>
                <span className="hero-sticker-arrow" aria-hidden="true">→</span>
              </a>
            )}
            <p className="hero-lede">
              Take your drinking to another level. One gallon jug, three ingredients, and a name
              nobody forgets.
            </p>
          </div>
          <div className="hero-actions">
            <a className="btn btn-acid" href="#borg">Name your borg</a>
            <a className="btn btn-ghost" href="#recipe">Get the recipe</a>
          </div>
        </div>
      </div>
    </section>
  );
}
