import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout, { inputClass } from "../components/AuthLayout";

export default function LoginPage() {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage("");
    setStatus("loading");
    window.setTimeout(() => {
      setStatus("idle");
      navigate("/");
    }, 600);
  };

  return (
    <AuthLayout>
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
          Welcome back
        </h1>
        <p className="mt-2 text-sm text-muted">
          Log in to save your favorite borg names.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
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
            autoComplete="current-password"
            className={inputClass}
            placeholder="••••••••"
          />
        </label>

        <button
          type="submit"
          disabled={status === "loading"}
          className="hero-btn hero-btn-block mt-2 border-transparent bg-gradient-to-r from-cyan to-sky-400 font-semibold text-on-accent transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "loading" ? "Please wait..." : "Log in"}
        </button>
        {status === "error" && errorMessage && (
          <p className="text-center text-sm text-red-500 dark:text-red-400">
            {errorMessage}
          </p>
        )}
      </form>

      <p className="mt-6 text-center text-sm text-subtle">
        Don&apos;t have an account?{" "}
        <Link to="/signup" className="text-cyan transition-colors hover:underline">
          Sign up
        </Link>
      </p>
    </AuthLayout>
  );
}
