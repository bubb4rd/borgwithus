import React from "react";
import SubpageHeader from "./SubpageHeader";

// Shared frame for /login, /register and /review: the generator card look, with the content on
// the paper label.
export default function AuthShell({ title, lede, children }) {
  return (
    <div className="auth-page">
      <SubpageHeader />
      <main className="auth-main">
        <div className="wrap">
          <div className="gen-card auth-card grain">
            <div className="gen-intro">
              <h1 className="display">{title}</h1>
              <p className="gen-copy">{lede}</p>
              <p className="gen-disclaimer">21+ only. Please drink responsibly.</p>
            </div>
            <div className="label auth-label">
              <div className="label-tape" aria-hidden="true" />
              {children}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
