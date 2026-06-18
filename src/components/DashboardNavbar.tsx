import { useRef } from "react";
import { Link, NavLink } from "react-router-dom";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import ThemeToggle from "./ThemeToggle";
import UserMenu from "./UserMenu";
import { HamburgerButton, MobileNavDrawer } from "./MobileNav";
import { useMobileMenu } from "../hooks/useMobileMenu";

const navLinks = [
  { to: "/dashboard/generator", label: "Generator" },
  { to: "/dashboard/leaderboard", label: "Leaderboard" },
  { to: "/dashboard/history", label: "History" },
];

const MOBILE_NAV_ID = "dashboard-mobile-nav";

function navClass({ isActive }: { isActive: boolean }) {
  return `dash-nav-item block rounded-lg px-3 py-2.5 text-sm transition-colors ${
    isActive
      ? "bg-hover font-medium text-foreground"
      : "text-muted hover:bg-hover hover:text-foreground"
  }`;
}

export default function DashboardNavbar() {
  const navRef = useRef<HTMLElement>(null);
  const { open, toggleMenu, closeMenu } = useMobileMenu();

  useGSAP(
    () => {
      gsap.from(".dash-nav-item", {
        y: -8,
        autoAlpha: 0,
        stagger: 0.05,
        duration: 0.5,
        ease: "power2.out",
        clearProps: "opacity,visibility,transform",
      });
    },
    { scope: navRef }
  );

  return (
    <header
      ref={navRef}
      className="sticky top-0 z-50 border-b border-border bg-card/85 backdrop-blur-xl"
    >
      <nav className="dash-nav-inner">
        <Link
          to="/dashboard"
          className="dash-nav-item text-base font-semibold tracking-tight text-foreground transition-colors hover:text-cyan md:text-lg"
        >
          borg<span className="text-cyan">with</span>us
          <span className="ml-2 hidden text-xs font-medium text-subtle sm:inline">
            / dashboard
          </span>
        </Link>

        <ul className="hidden items-center gap-0.5 md:flex">
          {navLinks.map((link) => (
            <li key={link.to}>
              <NavLink to={link.to} className={navClass}>
                {link.label}
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="hidden shrink-0 items-center gap-2 md:flex md:gap-3">
          <ThemeToggle />
          <UserMenu />
        </div>

        <div className="md:hidden">
          <HamburgerButton
            open={open}
            onClick={toggleMenu}
            controlsId={MOBILE_NAV_ID}
          />
        </div>
      </nav>

      <MobileNavDrawer
        id={MOBILE_NAV_ID}
        open={open}
        onClose={closeMenu}
        footer={<UserMenu dropUp />}
      >
        <ul className="space-y-1">
          {navLinks.map((link) => (
            <li key={link.to}>
              <NavLink
                to={link.to}
                className={navClass}
                onClick={closeMenu}
              >
                {link.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </MobileNavDrawer>
    </header>
  );
}
