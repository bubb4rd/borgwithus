import React from "react";

const YEAR = new Date().getFullYear();

export default function Footer() {
  return (
    <footer className="footer">
      <div className="wrap">
        <p className="footer-mark" aria-hidden="true">Borg with us</p>
        <div className="footer-row">
          <p>Please drink responsibly. 21+ only. Never drink and drive.</p>
          <p>
            © {YEAR}{" "}
            <a href="https://bohubbard.xyz" className="nav-link" target="_blank" rel="noopener noreferrer">
              BUBBARD
            </a>
          </p>
          <a href="#home" className="nav-link">Back to top ↑</a>
        </div>
      </div>
    </footer>
  );
}
