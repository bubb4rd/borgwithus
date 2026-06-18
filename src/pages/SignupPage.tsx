import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import AuthLayout, { inputClass } from "../components/AuthLayout";
import { useAuth } from "../context/AuthContext";

export default function SignupPage() {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const navigate = useNavigate();
  const { user, loading, signup } = useAuth();

  if (!loading && user) return <Navigate to="/dashboard" replace />;

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const name = (form.elements.namedItem("name") as HTMLInputElement).value;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    const password = (form.elements.namedItem("password") as HTMLInputElement)
      .value;
    const confirm = (
      form.elements.namedItem("confirmPassword") as HTMLInputElement
    ).value;

    if (password !== confirm) {
      setErrorMessage("Passwords do not match.");
      setStatus("error");
      return;
    }

    setErrorMessage("");
    setStatus("loading");
    window.setTimeout(() => {
      signup(name, email);
      setStatus("idle");
      navigate("/dashboard");
    }, 600);
  };

  return (
    <AuthLayout>
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
          Join borgwithus
        </h1>
        <p className="mt-2 text-sm text-muted">
          Create an account and take your drinking to the next level.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
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
            autoComplete="new-password"
            className={inputClass}
            placeholder="••••••••"
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm text-subtle">Confirm password</span>
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

        <button
          type="submit"
          disabled={status === "loading"}
          className="hero-btn hero-btn-block mt-2 border-transparent bg-gradient-to-r from-cyan to-sky-400 font-semibold text-on-accent transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "loading" ? "Please wait..." : "Create account"}
        </button>
        {status === "error" && errorMessage && (
          <p className="text-center text-sm text-red-500 dark:text-red-400">
            {errorMessage}
          </p>
        )}
      </form>

      <p className="mt-6 text-center text-sm text-subtle">
        Already have an account?{" "}
        <Link to="/login" className="text-cyan transition-colors hover:underline">
          Log in
        </Link>
      </p>
    </AuthLayout>
  );
}
