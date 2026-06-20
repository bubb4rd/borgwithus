import { useRef, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import ThemeToggle from "./ThemeToggle";

export const inputClass =
  "w-full rounded-xl border border-border bg-input px-4 py-3 text-foreground outline-none transition-colors focus:border-cyan/50";

type AuthLayoutProps = {
  children: ReactNode;
  showFooter?: boolean;
};

export default function AuthLayout({ children, showFooter = true }: AuthLayoutProps) {
  const pageRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap.from(".auth-card", {
        y: 24,
        autoAlpha: 0,
        duration: 0.7,
        ease: "power3.out",
        immediateRender: false,
        clearProps: "opacity,visibility,transform",
      });
    },
    { scope: pageRef }
  );

  return (
    <div ref={pageRef} className="site-bg relative min-h-screen">
      <header className="fixed top-4 left-4 right-4 z-50 site-container">
        <nav className="glass flex items-center justify-between rounded-2xl px-4 py-3 md:px-6">
          <Link
            to="/"
            className="text-lg font-semibold tracking-tight text-foreground transition-colors hover:text-cyan"
          >
            borg<span className="text-cyan">with</span>us
          </Link>
          <ThemeToggle />
        </nav>
      </header>

      <div className="flex min-h-screen items-center justify-center px-4 py-28">
        <div className="auth-card glass w-full max-w-md rounded-3xl p-6 sm:p-8">
          {children}
          {showFooter && (
            <p className="mt-6 text-center text-sm text-subtle">
              <Link to="/" className="text-cyan transition-colors hover:underline">
                ← Back to home
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
