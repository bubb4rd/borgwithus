import { useRef } from "react";
import { Link, Navigate } from "react-router-dom";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import AuthLayout from "../components/AuthLayout";
import {
  clearPendingEmailVerification,
  getPendingEmailVerification,
} from "../lib/pendingVerification";

function CheckIcon() {
  return (
    <svg
      className="confirm-check h-9 w-9 text-on-accent"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

export default function SignupConfirmPage() {
  const pageRef = useRef<HTMLDivElement>(null);
  const pending = getPendingEmailVerification();

  useGSAP(
    () => {
      if (!pending) return;

      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.from(".confirm-badge", {
        scale: 0.6,
        autoAlpha: 0,
        duration: 0.55,
        immediateRender: false,
      })
        .from(
          ".confirm-check",
          { scale: 0, duration: 0.35, ease: "back.out(2)" },
          "-=0.15"
        )
        .from(
          ".confirm-copy > *",
          {
            y: 14,
            autoAlpha: 0,
            duration: 0.45,
            stagger: 0.08,
            immediateRender: false,
            clearProps: "opacity,visibility,transform",
          },
          "-=0.1"
        );
    },
    { scope: pageRef, dependencies: [pending?.email] }
  );

  if (!pending) return <Navigate to="/signup" replace />;

  const { email } = pending;

  return (
    <AuthLayout showFooter={false}>
      <div ref={pageRef} className="text-center">
        <div className="confirm-badge relative mx-auto mb-6 flex h-20 w-20 items-center justify-center">
          <span
            className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan/25 to-sky-400/25 blur-md"
            aria-hidden
          />
          <span
            className="absolute inset-0 rounded-full border border-cyan/30"
            aria-hidden
          />
          <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-cyan to-sky-400 shadow-lg shadow-cyan/25">
            <CheckIcon />
          </span>
        </div>

        <div className="confirm-copy space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan">
            Account created
          </p>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
            Verify your email
          </h1>
          <p className="text-sm leading-relaxed text-muted">
            We sent a confirmation link to
          </p>
          <p className="rounded-xl border border-border bg-elevated px-4 py-3 text-sm font-medium text-foreground">
            {email}
          </p>
          <p className="text-sm leading-relaxed text-subtle">
            Click the link in that email to activate your account, then come back
            and log in.
          </p>
        </div>

        <div className="confirm-copy mt-8 flex flex-col gap-4">
          <Link
            to="/login"
            onClick={clearPendingEmailVerification}
            className="hero-btn hero-btn-block border-transparent bg-gradient-to-r from-cyan to-sky-400 font-semibold text-on-accent transition-opacity hover:opacity-90"
          >
            Go to log in
          </Link>
          <Link
            to="/"
            onClick={clearPendingEmailVerification}
            className="hero-btn hero-btn-block border-border bg-elevated font-medium text-foreground transition-colors hover:bg-hover"
          >
            Back to home
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}
