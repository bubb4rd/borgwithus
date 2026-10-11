import React from "react";

const STEPS = [
  {
    ingredient: "Water",
    amount: "½ gallon",
    text: "Fill a gallon plastic jug halfway.",
  },
  {
    ingredient: "Vodka",
    amount: "750 mL",
    text: "Pour in a small handle of Tito's or a vodka of your choice.",
  },
  {
    ingredient: "Mio",
    amount: "2 × 1.62 oz",
    text: "Pour in 2 packets of Mio (1.62 oz each).",
  },
];

export default function Recipe() {
  return (
    <section id="recipe" className="recipe">
      <div className="wrap">
        <div className="section-head">
          <h2 className="display">How to borg?</h2>
        </div>
        <ol className="steps">
          {STEPS.map((step, i) => (
            <li className="step" key={step.ingredient}>
              <div className="step-top">
                <span className="step-num">{String(i + 1).padStart(2, "0")}</span>
                <span className="chip">{step.amount}</span>
              </div>
              <h3 className="step-ingredient">{step.ingredient}</h3>
              <p className="step-text">{step.text}</p>
            </li>
          ))}
        </ol>
        <a className="step-next" href="#borg">
          <span className="step-next-num">04</span>
          <span>Cap it. Shake it. Name it.</span>
          <span className="step-next-arrow" aria-hidden="true">↓</span>
        </a>
      </div>
    </section>
  );
}
