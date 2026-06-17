import { useRef, type MouseEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import ThemeToggle from "./ThemeToggle";
import { scrollToSection } from "../lib/scrollToSection";

const links = [
  { href: "/#hero", label: "Home" },
  { href: "/#how-to", label: "How to BORG" },
  { href: "/#about", label: "What is BORG" },
  { href: "/#generator", label: "Generator" },
  { href: "/#contact", label: "Contact" },
];

export default function Navbar() {
  const navRef = useRef<HTMLElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  const handleSectionClick = (
    e: MouseEvent<HTMLAnchorElement>,
    href: string
  ) => {
    const hash = href.includes("#") ? href.slice(href.indexOf("#")) : "";

    if (!hash) return;

    e.preventDefault();

    if (location.pathname !== "/") {
      navigate({ pathname: "/", hash: hash.slice(1) });
      return;
    }

    scrollToSection(hash);
    window.history.replaceState(null, "", hash);
  };

  const handleHomeClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (location.pathname !== "/") return;

    e.preventDefault();
    scrollToSection("#hero");
    window.history.replaceState(null, "", "/");
  };

  useGSAP(
    () => {
      gsap.from(".nav-item", {
        y: -12,
        autoAlpha: 0,
        stagger: 0.06,
        duration: 0.6,
        ease: "power2.out",
        delay: 0.2,
        immediateRender: false,
        clearProps: "opacity,visibility,transform",
      });
    },
    { scope: navRef }
  );

  return (
    <header
      ref={navRef}
      className="fixed top-4 left-4 right-4 z-50 mx-auto max-w-6xl"
    >
      <nav className="glass flex items-center justify-between gap-3 rounded-2xl px-4 py-3 md:px-6">
        <Link
          to="/"
          onClick={handleHomeClick}
          className="nav-item text-lg font-semibold tracking-tight text-foreground transition-colors hover:text-cyan"
        >
          borg<span className="text-cyan">with</span>us
        </Link>
        <ul className="hidden items-center gap-1 md:flex">
          {links.slice(1).map((link) => (
            <li key={link.href}>
              <Link
                to={link.href}
                onClick={(e) => handleSectionClick(e, link.href)}
                className="nav-item cursor-pointer rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-hover hover:text-foreground"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            to="/login"
            className="nav-item hidden cursor-pointer rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-cyan/40 hover:bg-hover sm:inline-flex"
          >
            Log in
          </Link>
        </div>
      </nav>
    </header>
  );
}
