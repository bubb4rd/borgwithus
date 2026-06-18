# borgwithus

Modern Borg name generator — React, GSAP, Tailwind.

## Development

```bash
npm install
npm run dev
```

## Authentication

Sign-up and login use [Supabase](https://supabase.com) email/password auth.

1. Create a free Supabase project.
2. In **Authentication → Providers**, enable Email.
3. Run `supabase/schema.sql` in the **SQL editor** (creates the `profiles` table and RLS policies).
4. Copy `.env.example` to `.env` and fill in your project URL and anon key from **Project Settings → API**.
5. Restart the dev server.

Without those env vars, auth falls back to local demo mode (no real passwords).

For borg stats (likes, ratings, saved names, rolls), run `supabase/borg-data.sql` in the SQL editor when you're ready to persist data in Supabase instead of localStorage.

## Build

```bash
npm run build
```

Output goes to `dist/`. Deploy that folder to your static host (GitHub Pages, Netlify, etc.).

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in your host’s environment variables for production auth.

## Stack

- **React + Vite + TypeScript**
- **GSAP** — hero entrance, scroll reveals, name scramble micro-animations
- **Tailwind CSS v4** — dark UI with subtle gradient background
- **Inter** — modern sans-serif typography
- **EmailJS** — contact form
