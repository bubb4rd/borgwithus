import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function UserMenu({ dropUp = false }: { dropUp?: boolean }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!user) return null;

  const close = () => setOpen(false);

  const handleLogout = () => {
    close();
    void logout().then(() => navigate("/"));
  };

  const itemClass =
    "flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-hover";

  const onPublicSite =
    location.pathname !== "/dashboard" &&
    !location.pathname.startsWith("/dashboard/");

  const onAdminDashboard = location.pathname.startsWith("/dashboard/admin");

  const showDashboardLink = onPublicSite || onAdminDashboard;
  const showAdminLink = user.isAdmin && !onAdminDashboard;

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account menu"
        className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-cyan-800 text-white transition-opacity hover:opacity-90"
      >
        <svg
          width={20}
          height={20}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className={`glass absolute right-0 z-50 w-52 overflow-hidden rounded-2xl border border-border py-1 shadow-lg ${
            dropUp
              ? "bottom-[calc(100%+0.5rem)]"
              : "top-[calc(100%+0.5rem)]"
          }`}
        >
          <div className="border-b border-border px-3 py-2.5">
            <p className="truncate text-sm font-semibold text-foreground">
              {user.name}
            </p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>

          <div className="p-1">
            {showDashboardLink && (
              <Link
                to="/dashboard"
                role="menuitem"
                onClick={close}
                className={itemClass}
              >
                Dashboard
              </Link>
            )}
            {showAdminLink && (
              <Link
                to="/dashboard/admin"
                role="menuitem"
                onClick={close}
                className={itemClass}
              >
                Admin
              </Link>
            )}
            <Link
              to="/dashboard/settings"
              role="menuitem"
              onClick={close}
              className={itemClass}
            >
              Settings
            </Link>
            {!onPublicSite && (
              <Link
                to="/"
                role="menuitem"
                onClick={close}
                className={itemClass}
              >
                Public site
              </Link>
            )}
            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              className={`${itemClass} text-red-600 dark:text-red-400`}
            >
              Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
