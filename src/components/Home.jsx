import React from "react";
import jug from "../assets/borgwithus.png";
import HeroShader from "./HeroShader";

export default function Home() {
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
          <p className="hero-lede">
            Take your drinking to another level. One gallon jug, three ingredients, and a name
            nobody forgets.
          </p>
          <div className="hero-actions">
            <a className="btn btn-acid" href="#borg">Name your borg</a>
            <a className="btn btn-ghost" href="#recipe">Get the recipe</a>
          </div>
        </div>
      </div>
    </section>
  );
}
