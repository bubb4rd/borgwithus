import React from "react";

export function Panel({ title, sub, aside, className = "", children }) {
  return (
    <section className={`dash-panel ${className}`}>
      <header className="dash-panel-head">
        <div>
          <h2 className="dash-panel-title">{title}</h2>
          {sub && <p className="dash-panel-sub">{sub}</p>}
        </div>
        {aside}
      </header>
      {children}
    </section>
  );
}

export function Empty({ children }) {
  return <p className="dash-empty">{children}</p>;
}
