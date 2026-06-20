import { useRef, useState, type FormEvent } from "react";
import emailjs from "@emailjs/browser";

const SERVICE_ID = "service_gvbb14x";
const TEMPLATE_ID = "template_a944037";
const PUBLIC_KEY = "xpY7UemGR-1GYIahJ";

export default function Contact() {
  const formRef = useRef<HTMLFormElement>(null);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formRef.current) return;

    setStatus("sending");
    try {
      await emailjs.sendForm(
        SERVICE_ID,
        TEMPLATE_ID,
        formRef.current,
        PUBLIC_KEY
      );
      setStatus("sent");
      formRef.current.reset();
    } catch {
      setStatus("error");
    }
  };

  return (
    <section id="contact" className="px-4 py-24 md:px-8">
      <div className="site-container">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          <div data-reveal>
            <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-cyan">
              Contact us
            </p>
            <h2 className="mb-4 text-4xl font-bold text-foreground md:text-5xl">
              Drop us a line
            </h2>
            <p className="mb-6 text-lg text-muted">
              Fill out this form and we&apos;ll hop straight to it.
            </p>
            <p className="mb-8 text-subtle">
              Got ideas on how we can improve your experience? Got a few couple
              Borg names you thought of? Drop us a line by any means.
            </p>
            <div className="glass rounded-2xl p-6">
              <h3 className="mb-2 text-lg font-semibold text-foreground">
                Disclaimer
              </h3>
              <p className="text-sm leading-relaxed text-subtle">
                We handle inquiries on a case-by-case basis, promising to give
                yours the spotlight it deserves. So fire away with questions,
                ideas, or just a friendly &apos;hello&apos; — we can&apos;t wait
                to dive into the delicious details!
              </p>
            </div>
          </div>

          <div data-reveal className="glass rounded-3xl p-6 md:p-8">
            <h3 className="mb-6 text-xl font-semibold text-foreground">
              Send us a message
            </h3>
            <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm text-subtle">
                    First Name
                  </span>
                  <input
                    type="text"
                    name="firstname"
                    required
                    className="w-full rounded-xl border border-border bg-input px-4 py-3 text-foreground outline-none transition-colors focus:border-cyan/50"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm text-subtle">
                    Last Name
                  </span>
                  <input
                    type="text"
                    name="lastname"
                    required
                    className="w-full rounded-xl border border-border bg-input px-4 py-3 text-foreground outline-none transition-colors focus:border-cyan/50"
                  />
                </label>
              </div>
              <label className="block">
                <span className="mb-2 block text-sm text-subtle">
                  Email address
                </span>
                <input
                  type="email"
                  name="email"
                  required
                  className="w-full rounded-xl border border-border bg-input px-4 py-3 text-foreground outline-none transition-colors focus:border-cyan/50"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm text-subtle">
                  How can we help?
                </span>
                <textarea
                  name="message"
                  rows={5}
                  required
                  className="w-full resize-none rounded-xl border border-border bg-input px-4 py-3 text-foreground outline-none transition-colors focus:border-cyan/50"
                />
              </label>
              <button
                type="submit"
                disabled={status === "sending"}
                className="w-full cursor-pointer rounded-full bg-gradient-to-r from-cyan to-sky-400 py-3.5 text-sm font-semibold text-on-accent transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {status === "sending" ? "Sending..." : "Send message"}
              </button>
              {status === "sent" && (
                <p className="text-center text-sm text-lime">
                  Message sent! We&apos;ll be in touch.
                </p>
              )}
              {status === "error" && (
                <p className="text-center text-sm text-red-500 dark:text-red-400">
                  Something went wrong. Please try again.
                </p>
              )}
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
