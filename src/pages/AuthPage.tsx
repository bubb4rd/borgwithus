import { useRef, useState, useEffect, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import ThemeToggle from "../components/ThemeToggle";

type AuthMode = "login" | "signup";

const inputClass =
  "w-full rounded-xl border border-border bg-input px-4 py-3 text-foreground outline-none transition-colors focus:border-cyan/50";

export default function AuthPage() {
  const [searchParams] = useSearchParams();
  const initialMode: AuthMode =
    searchParams.get("tab") === "signup" ? "signup" : "login";
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const navigate = useNavigate();
  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "signup") setMode("signup");
    else if (tab === "login") setMode("login");
  }, [searchParams]);

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
    { scope: pageRef, dependencies: [mode] }
  );

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const password = (form.elements.namedItem("password") as HTMLInputElement)
      .value;
    const confirm = (
      form.elements.namedItem("confirmPassword") as HTMLInputElement | null
    )?.value;

    if (mode === "signup" && password !== confirm) {
      setErrorMessage("Passwords do not match.");
      setStatus("error");
      return;
    }

    setErrorMessage("");
    setStatus("loading");
    window.setTimeout(() => {
      setStatus("idle");
      navigate("/");
    }, 600);
  };

  return (
    <div ref={pageRef} className="site-bg relative min-h-screen">
      <header className="fixed top-4 left-4 right-4 z-50 mx-auto max-w-6xl">
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
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
              {mode === "login" ? "Welcome back" : "Join borgwithus"}
            </h1>
            <p className="mt-2 text-sm text-muted">
              {mode === "login"
                ? "Log in to save your favorite borg names."
                : "Create an account and take your drinking to the next level."}
            </p>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-1 rounded-full border border-border bg-elevated p-1">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setStatus("idle");
                setErrorMessage("");
              }}
              className={`cursor-pointer rounded-full py-2.5 text-sm font-semibold transition-colors ${
                mode === "login"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              Log in
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setStatus("idle");
                setErrorMessage("");
              }}
              className={`cursor-pointer rounded-full py-2.5 text-sm font-semibold transition-colors ${
                mode === "signup"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              Sign up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <label className="block">
                <span className="mb-2 block text-sm text-subtle">Name</span>
                <input
                  type="text"
                  name="name"
                  required
                  autoComplete="name"
                  className={inputClass}
                  placeholder="Your name"
                />
              </label>
            )}
            <label className="block">
              <span className="mb-2 block text-sm text-subtle">Email</span>
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                className={inputClass}
                placeholder="you@example.com"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-subtle">Password</span>
              <input
                type="password"
                name="password"
                required
                minLength={8}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                className={inputClass}
                placeholder="••••••••"
              />
            </label>
            {mode === "signup" && (
              <label className="block">
                <span className="mb-2 block text-sm text-subtle">
                  Confirm password
                </span>
                <input
                  type="password"
                  name="confirmPassword"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className={inputClass}
                  placeholder="••••••••"
                />
              </label>
            )}

            <button
              type="submit"
              disabled={status === "loading"}
              className="hero-btn hero-btn-block mt-2 border-transparent bg-gradient-to-r from-cyan to-sky-400 font-semibold text-on-accent transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status === "loading"
                ? "Please wait..."
                : mode === "login"
                  ? "Log in"
                  : "Create account"}
            </button>
            {status === "error" && errorMessage && (
              <p className="text-center text-sm text-red-500 dark:text-red-400">
                {errorMessage}
              </p>
            )}
          </form>

          <p className="mt-6 text-center text-sm text-subtle">
            <Link to="/" className="text-cyan transition-colors hover:underline">
              ← Back to home
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
