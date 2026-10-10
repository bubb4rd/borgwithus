import React from "react";

const ACRONYM = ["Black", "Out", "Rage", "Gallon"];

export default function About() {
  return (
    <section id="what" className="what">
      <div className="wrap what-grid">
        <h2 className="acronym" aria-label="Black Out Rage Gallon">
          {ACRONYM.map((word) => (
            <span className="acronym-word" key={word} aria-hidden="true">
              <span className="acronym-initial">{word[0]}</span>
              {word.slice(1)}
            </span>
          ))}
        </h2>
        <div className="what-copy">
          <p className="what-lede">
            BORG is no ordinary concoction. It is the elixir of the gods, meticulously crafted to
            transcend the boundaries of taste and sensation.
          </p>
          <p>
            To partake in this sacred ritual, one wields a half-filled gallon jug, symbolizing
            purity and vitality through water. This vessel becomes the crucible for an alchemical
            transformation. With each measured pour, BORG becomes an experience that invigorates
            the body and nourishes the soul. It is a communion with the divine, an invocation of
            primal energies, and a testament to the mastery of the craft.
          </p>
          <p className="what-sign">
            Join us in raising our jugs to the heavens, celebrating BORG, the cocktail of the gods.
          </p>
        </div>
      </div>
    </section>
  );
}
