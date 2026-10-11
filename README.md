# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Accounts, BORG AI and the leaderboard (Supabase)

Signed-in members can like names, send in three of their own names a day for the wall, and spend five BORG AI credits a day (all daily limits reset at midnight UTC); an admin approves each sent-in name before it appears. The leaderboard ranks names by likes. Without the env vars below the site still runs, with those features shown as offline.

1. Copy `.env.example` to `.env.local` and fill in the project URL and anon key (Supabase → Project Settings → API).
2. Link the project and apply the schema: `npx supabase link --project-ref gfmxznmnclbsdenozrxd`, then `npm run db:push`.
   The migration copies likes from the old `user_saved_likes` table if it exists. The old tables are left alone.
3. Set the AI secrets and deploy the functions:
   `npx supabase secrets set AI_INFERENCE_API_HOST=https://ai.borgwithus.xyz BORG_AI_MODEL=llama2-uncensored`, then `npm run ai:deploy` (deploys `generate-borg-name` and `borg-ai-studio`; bundled on Supabase's side, so Docker isn't needed). The uncensored model is what gets the cruder names; the Ollama server must have it pulled (`ollama pull llama2-uncensored`). If the model server needs a key (a Runpod Serverless endpoint does), also set `AI_INFERENCE_API_KEY`; it's sent as `Authorization: Bearer <key>`.
4. In Supabase → Authentication → URL Configuration, set the site URL to the production domain and allow `<domain>/login` as a redirect (used by confirmation emails).
5. Make yourself an admin in Supabase → SQL Editor:
   `insert into public.borg_admins (user_id) select id from auth.users where email = 'you@example.com';`
   Admins get "Dashboard" (`/admin`: 7/14/30/90-day ranges compared with the previous period — rolls by kind, signups and member growth, today's pace, roll mix, weekday pattern, member/engagement/review ratios, recent rolls and signups, most-liked names, and a daily numbers table) and "Review queue" (`/review`: approve or reject pending names) in the account menu. The "AI Borg Studio" tab (`/admin?tab=studio`) is the tinker lab for BORG AI: generate test batches of 5 originals with any prompt version (built exactly like a member roll, no credits spent), see who made each name (AI swap, code swap, or AI tacked on), the run at a glance (model time, tokens sent, originals on offer, AI and code swaps, tacked on, thrown out, missing), and the exact prompt sent and the raw reply side by side, each with a Copy button; rate each name 👍/👎 (with a reason) or ✏️ (with the fixed name); ⭐ names into the example pool, or open the pool's + to tick one or many names already on the board (the classics, approved member names and AI names rated 👍/✏️; a name without a known original gets a field for it) and add them in one go, or type a pair that isn't on the board; switch examples on and off; compare prompt versions (ratings bar, good share, AI good share) and export one version's statistics or all of them as CSV (settings, rating counts, good and AI good shares, system prompt), save new ones (with an estimate of how long the model server will take) and compare two on the same topic, one after the other; make one live; see which live AI names members ❤️ or 👎; and export everything rated as fine-tuning files (see `training/README.md`). The Playground rates from the keyboard (key legend above the results; not while typing): `J`/`K` or the arrow keys move the highlighted name, `1` 👍 (then on to the next unrated name), `2` 👎 and `3` ✏️ open their form, `S` ⭐, `Enter` saves and `Esc` closes a form (or leaves the theme field), `G` generates; in compare mode they act on the column last clicked. "Keep the next batch cooking" (off by default, one version only) asks for the next batch with the same version and theme as soon as one lands, so Generate shows it instantly; it holds the shared model server, so members' rolls wait while it cooks.
   The "Borgs" tab (`/admin?tab=borgs`) is the whole board in one table: every borg with its original, source (Classic, Member, AI), category, featured ⭐, likes (and 👎), rolls and when it was added. Search, filter by source, category or featured, and sort by any column; add a borg (it goes in as a classic), edit one in place (`Enter` saves, `Esc` cancels), ⭐ it onto the home page marquee, or tick many to set or clear their category, feature or unfeature them, or delete them. Renaming carries the name's likes and 👎s over; renaming a member's name renames their submission too; deleting one marks its submission rejected. Categories are free text; the field suggests the ones in use plus a starter set.

Where things live:

- `supabase/migrations/` — `borg_likes` (one row per member and name), `borg_like_counts` (kept in sync by trigger, read by the leaderboard), `ai_credit_usage` plus the credit functions. Only the edge function can spend or refund credits.
- `supabase/migrations/…_borg_submissions.sql` — `borg_submissions` (member-sent names, `pending` until an admin approves or rejects them, unique by letters and digits across every status) and `borg_admins`. Neither table has grants; the site goes through `get_borg_wall()` (newest 12 approved, plus the caller's own pending and rejected), `get_borg_submission_quota()`, `submit_borg_name()`, `remove_borg_submission()` (frees that day's slot), and the admin-only `get_borg_review_queue()` and `review_borg_submission()`. Members without a name show as the first 8 characters of their account id.
- `supabase/migrations/…_borg_admin_dashboard.sql` — `borg_rolls` (every classic BORG/MIO roll, guests included, plus each BORG AI name; history copied from the old `user_rolls` table), `log_borg_roll()` (called by the generator for classic rolls) and the admin-only `get_admin_dashboard()`.
- `supabase/migrations/…_borg_ai_context.sql` — `get_borg_ai_context()` (service role only): liked and approved names to sample as prompt examples, every liked, submitted and recent AI name to avoid, and the latest 20 AI names to show the model as already used.
- `supabase/migrations/…_borg_ai_originals.sql` — `borg_rolls.original` (what an AI name riffs on, "Morgan Freeman" for "Borgan Freeman"; null for classic and older rolls) and `originals` in `get_borg_ai_context()`: originals of the latest AI rolls, so new names pick other references.
- `supabase/migrations/…_borg_ai_studio.sql` — `borg_ai_prompts` (prompt versions, never edited once saved; at most one live; `{count}` in the text stands for the number of lines asked for; v1 is the edge function's built-in prompt), `borg_ai_examples` (format-example pairs with an on/off switch; seeded with `STYLE_PAIRS`) and `borg_ai_ratings` (Studio verdicts tied to the version that made the name). No grants; the Studio goes through the admin-only `get_borg_studio()`, `save_borg_prompt()`, `set_live_borg_prompt()`, `add_borg_example()`, `set_borg_example_enabled()` and `rate_borg_name()`, and the edge functions read a version and the switched-on examples through `get_borg_ai_prompt()` (service role only).
- `supabase/migrations/…_borg_ai_sources.sql` — `source` on `borg_rolls` and `borg_ai_ratings`: who made an AI name, the model's own line (`model`) or the code's sound swap (`code`); `rate_borg_name()` takes it and `get_borg_studio()` adds `model_good`/`model_rated` per version, so "AI good" measures the prompt without code swaps.
- `supabase/migrations/…_borg_ai_dislikes.sql` — `borg_ai_dislikes` (one row per member and BORG AI name they 👎; members read, add and remove their own, and liking a name drops the dislike and vice versa), the admin-only `get_borg_ai_feedback()` (AI names rolled in the last 1–365 days that members liked or disliked, with their latest original and source, rolls, likes and dislikes, for the AI Borg Studio) and `examples` in `get_borg_ai_context()` now skipping names with at least as many dislikes as likes.
- `supabase/migrations/…_borg_ai_training.sql` — the admin-only `get_borg_ai_training_data()`: every Studio rating, live AI names members liked more than they disliked (with their original) and the switched-on example pool, which the Studio turns into SFT and DPO files (`src/pages/admin/trainingData.js`).
- `supabase/migrations/…_borg_board_pool.sql` — `get_borg_board_pool()`, the Studio's first board-pool source; dropped by `…_borg_catalog.sql`.
- `supabase/migrations/…_borg_catalog.sql` — `borgs`: every borg on the board, one row per name (unique by letters and digits), with its `source` (`classic`: the old `src/data.json` list, seeded here, plus names admins add; `member`: an approved submission, linked by `submission_id`; `ai`: a name rated 👍 or ✏️ fixed in the Studio, unless its latest rating is 👎), `original`, `category` and `featured`. Anyone reads the name, original, source and featured columns: the generator rolls from them, the marquee shows the featured names, BORG AI avoids them all and the Studio's example-pool quick add lists them (`src/context/BorgsContext.jsx`; the classics in `src/data.json` stand in until the table answers, and when Supabase is offline). Triggers add approved submissions and Studio-rated AI names and drop them again; `submit_borg_name()` turns away names already on the board. Admins go through `admin_list_borgs()`, `admin_save_borg()`, `admin_delete_borgs()`, `admin_set_borg_category()` and `admin_set_borg_featured()`.
- `training/` — fine-tuning recipe: `README.md` (collect, export, train, install in Ollama, switch `BORG_AI_MODEL`) and `train_borg_lora.py` (LoRA on llama2-uncensored's base weights with Unsloth, merged to a q4_k_m GGUF plus a Modelfile with its template; `--dry-run` checks an export without a GPU).
- `supabase/functions/_shared/` — `borg-ai.ts` (prompt building, the model call, parsing, repeat checks, `swapsSound` and `codeSwap`; no Deno or Supabase APIs), `borg-setup.ts` (loads the prompt version and `get_borg_ai_context()` for a batch) and `http.ts`, shared by both functions. The model server reads ~20 and writes ~4 tokens a second, so the prompt is kept short. `borg-ai.test.ts` pins the name rules (which swaps count, code swaps, repeat checks, reply parsing, picking, prompt building) with fixed inputs; run it with `npm run test:ai` (Deno via npx, no install needed) after changing them.
- `supabase/functions/generate-borg-name/` — checks the session, spends a credit, loads the live Studio prompt version (the built-in prompt when none is live) and `get_borg_ai_context()`, asks the Ollama model for a batch of 5 `Original -> BORG name` pairs (random examples each call, a random topic when the theme is blank), and drops any original that repeats or respells a known one (whole-word containment either way, or within one letter edit per 5 letters). Each fresh original offers the model's name if it really swaps a sound (`swapsSound`: "Ron Burgundy -> Ron Borgundy", not "Taylor Swift -> Taylorborg") and the code's own swap of its most borg-like sound (`codeSwap`: "Michael Jordan -> Michael Borgan"), skipping known names; one of those is handed out at random, or a tacked-on model name when there are none. The credit is refunded if nothing survives 3 batches, and each name is logged with its original and source to `borg_rolls`.
- `supabase/functions/borg-ai-studio/` — admin-only Studio test batches: one batch with a chosen prompt version, built like a member roll, returning every name on offer with its source, the dropped repeats, the originals that offer no name and why (thrown out as a repeat, or no usable name), the topic, the exact prompt, the raw reply and the model time. Spends no credits and logs no rolls. The Playground lists those, plus a "missing" row for each of the 5 the model never wrote a usable line for.
- `infra/ollama-worker/` — the BORG AI model server on a Runpod Serverless **load balancing** endpoint: Ollama 0.40.2 with `llama2-uncensored` baked in, fronted by `worker.py`, which answers the load balancer's `GET /ping` (204 until the model is in GPU memory, 200 after) and passes everything else to Ollama. `.github/workflows/ollama-worker.yml` builds it on GitHub, pushes `ghcr.io/bubb4rd/borg-ollama-worker:<commit>`, and smoke-tests the image on CPU (`/ping` reaches 200, `/api/chat` answers). Endpoint settings: expose `8000/http`, env `PORT=8000` and `PORT_HEALTH=8000` (on port 80 the health checks never reached the worker), 0 active workers, 5 s idle timeout. Point `AI_INFERENCE_API_HOST` at `https://<endpoint-id>.api.runpod.ai` and set `AI_INFERENCE_API_KEY` to a Runpod API key. After changing the template image, delete the endpoint's old workers: FlashBoot otherwise resumes them on the previous image.
- `public/_redirects` — Netlify SPA fallback so `/login`, `/register`, `/review` and `/admin` load on refresh.

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
