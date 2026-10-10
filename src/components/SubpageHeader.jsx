import React from "react";
import { Link } from "react-router-dom";

// Header for pages outside the one-page home: wordmark home, extra links, then the way back.
export default function SubpageHeader({ children }) {
  return (
    <header className="site-header">
      <div className="wrap header-inner">
        <Link to="/" className="wordmark" aria-label="Borg With Us, home">
          <span>Borg</span>
          <span>with us</span>
        </Link>
        <nav className="header-auth" aria-label="Page">
          {children}
          <Link to="/" className="nav-link">
            ← Back to the borg
          </Link>
        </nav>
      </div>
    </header>
  );
}
