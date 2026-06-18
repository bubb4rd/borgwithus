import { Link } from "react-router-dom";
import ThemeToggle from "./ThemeToggle";
import UserMenu from "./UserMenu";

export default function AdminNavbar() {
  return (
    <header className="dash-topbar sticky top-0 z-50">
      <nav className="dash-nav-inner">
        <Link
          to="/dashboard/admin"
          className="min-w-0 text-base font-semibold tracking-tight text-foreground transition-colors hover:text-cyan md:text-lg"
        >
          borg<span className="text-cyan">with</span>us
          <span className="ml-2 hidden text-xs font-medium text-subtle sm:inline">
            / admin
          </span>
        </Link>

        <div className="flex shrink-0 items-center gap-2 md:gap-3">
          <Link
            to="/"
            className="dash-nav-action text-[var(--dash-muted)] hover:text-[var(--dash-foreground)]"
          >
            Public site
          </Link>
          <ThemeToggle />
          <UserMenu />
        </div>
      </nav>
    </header>
  );
}
