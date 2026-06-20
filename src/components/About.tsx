export default function About() {
  return (
    <section id="about" className="px-4 py-24 md:px-8">
      <div className="site-container">
        <div
          data-reveal
          className="glass relative overflow-hidden rounded-3xl p-8 md:p-12"
        >
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-magenta/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-cyan/10 blur-3xl" />
          <div className="relative max-w-3xl">
            <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-magenta">
              The lore
            </p>
            <h2 className="mb-6 text-4xl font-bold text-foreground md:text-5xl">
              What is a BORG?
            </h2>
            <p className="text-lg leading-relaxed text-muted">
              BORG, an acronym for{" "}
              <strong className="font-semibold text-foreground">
                Black Out Rage Gallon
              </strong>
              , is no ordinary concoction. It is the elixir of the gods,
              meticulously crafted to transcend the boundaries of taste and
              sensation. To partake in this sacred ritual, one wields a
              half-filled gallon jug, symbolizing purity and vitality through
              water. This vessel becomes the crucible for an alchemical
              transformation. With each measured pour, BORG becomes an
              experience that invigorates the body and nourishes the soul. It is
              a communion with the divine, an invocation of primal energies, and
              a testament to the mastery of the craft. Join us in raising our
              jugs to the heavens, celebrating BORG, the cocktail of the gods.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
