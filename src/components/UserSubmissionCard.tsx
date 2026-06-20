import { useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { submitUserBorgName } from "../lib/userSubmissions";

export default function UserSubmissionCard() {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      submitUserBorgName({
        name,
        userId: user?.id ?? null,
        userName: user?.name,
      });
      setName("");
      setSubmitted(true);
    } catch (submitError) {
      setSubmitted(false);
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not submit this name.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="dashboard-panel flex h-full flex-col p-5 sm:p-6">
      <p className="dash-eyebrow">User submission</p>
      <h2 className="mt-1 text-xl font-bold text-foreground">
        Submit your BORG!
      </h2>

      {submitted ? (
        <div className="mt-4 rounded-xl border border-cyan/25 bg-cyan/10 px-4 py-3 text-sm text-cyan">
          Your BORG name is under review
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 flex min-h-0 flex-1 flex-col gap-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-subtle">
              Borg name
            </span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              placeholder="e.g. Borgingham Palace"
              className="w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-cyan/40"
            />
          </label>

          {error ? (
            <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="mt-auto inline-flex h-11 cursor-pointer items-center justify-center rounded-full bg-gradient-to-br from-cyan to-sky-400 px-5 text-sm font-semibold text-on-accent shadow-md transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Submitting…" : "Submit name"}
          </button>
        </form>
      )}

      {submitted ? (
        <button
          type="button"
          onClick={() => setSubmitted(false)}
          className="mt-auto inline-flex h-11 cursor-pointer items-center justify-center rounded-full border border-border px-5 text-sm font-semibold text-foreground transition-colors hover:bg-hover"
        >
          Submit another
        </button>
      ) : null}
    </section>
  );
}
