import { useState, type FormEvent } from "react";
import DashboardPageHeader from "../components/DashboardPageHeader";
import DashboardShell from "../components/DashboardShell";
import { useAuth } from "../context/AuthContext";

const inputClass =
  "w-full rounded-xl border border-border bg-input px-4 py-3 text-foreground outline-none transition-colors focus:border-cyan/50";

export default function SettingsPage() {
  const { user, updateUser } = useAuth();
  const [saved, setSaved] = useState(false);

  if (!user) return null;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const name = (form.elements.namedItem("name") as HTMLInputElement).value;
    const emailNotifications = (
      form.elements.namedItem("emailNotifications") as HTMLInputElement
    ).checked;

    try {
      await updateUser({
        name,
        settings: { ...user.settings, emailNotifications },
      });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    } catch {
      setSaved(false);
    }
  };

  return (
    <DashboardShell>
      <div className="mx-auto max-w-lg">
        <DashboardPageHeader eyebrow="Account" title="Settings" />

        <form
          onSubmit={handleSubmit}
          className="dashboard-panel space-y-5 p-5 sm:p-6"
        >
          <label className="block">
            <span className="mb-2 block text-sm text-subtle">Display name</span>
            <input
              type="text"
              name="name"
              required
              defaultValue={user.name}
              className={inputClass}
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-subtle">Email</span>
            <input
              type="email"
              name="email"
              disabled
              value={user.email}
              className={`${inputClass} cursor-not-allowed opacity-60`}
            />
          </label>

          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-elevated px-4 py-3">
            <input
              type="checkbox"
              name="emailNotifications"
              defaultChecked={user.settings.emailNotifications}
              className="h-4 w-4 accent-cyan"
            />
            <span className="text-sm text-foreground">Email notifications</span>
          </label>

          <button
            type="submit"
            className="hero-btn hero-btn-block cursor-pointer border-transparent bg-gradient-to-r from-cyan to-sky-400 font-semibold text-on-accent transition-opacity hover:opacity-90"
          >
            {saved ? "Saved!" : "Save settings"}
          </button>
        </form>
      </div>
    </DashboardShell>
  );
}
