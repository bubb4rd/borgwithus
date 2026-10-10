import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function AccountMenu() {
  const { user, displayName, isAdmin, logOut } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutside = (event) => {
      if (!menuRef.current.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div className="account" ref={menuRef}>
      <button
        type="button"
        className="account-btn"
        aria-expanded={open}
        aria-label={`Account: ${displayName}`}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="account-avatar" aria-hidden="true">
          {displayName.charAt(0)}
        </span>
        <span className="account-name">{displayName}</span>
      </button>
      {open && (
        <div className="account-menu">
          <p className="account-email">{user.email}</p>
          <a href="#ai" className="account-item" onClick={() => setOpen(false)}>
            BORG AI credits
          </a>
          <a href="#submit" className="account-item" onClick={() => setOpen(false)}>
            Submit a borg
          </a>
          {isAdmin && (
            <>
              <Link to="/admin" className="account-item">
                Dashboard
              </Link>
              <Link to="/review" className="account-item">
                Review queue
              </Link>
            </>
          )}
          <button type="button" className="account-item" onClick={logOut}>
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

function AuthControls() {
  const { online, ready, user } = useAuth();

  if (!online) {
    return (
      <a href="#borg" className="btn btn-acid btn-sm">
        Let's borg
      </a>
    );
  }
  if (!ready) return <div className="header-auth" aria-hidden="true" />;
  if (user) return <AccountMenu />;

  return (
    <div className="header-auth">
      <Link to="/login" state={{ from: "/#ai" }} className="nav-link">
        Log in
      </Link>
      <Link to="/register" state={{ from: "/#ai" }} className="btn btn-acid btn-sm">
        Sign up
      </Link>
    </div>
  );
}

export default function NavBar() {
  return (
    <header className="site-header">
      <div className="wrap header-inner">
        <a href="#home" className="wordmark" aria-label="Borg With Us, back to top">
          <span>Borg</span>
          <span>with us</span>
        </a>
        <nav aria-label="Primary">
          <ul className="nav-list">
            <li><a href="#what" className="nav-link">What's a borg</a></li>
            <li><a href="#recipe" className="nav-link">Recipe</a></li>
            <li><a href="#borg" className="nav-link">Generator</a></li>
            <li><a href="#submit" className="nav-link">Submit</a></li>
          </ul>
        </nav>
        <AuthControls />
      </div>
    </header>
  );
}
