# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Accounts, BORG AI and the leaderboard (Supabase)

Signed-in members can like names, send in three of their own names a day for the wall, and spend five BORG AI credits a day (all daily limits reset at midnight UTC); an admin approves each sent-in name before it appears. The leaderboard ranks names by likes. Without the env vars below the site still runs, with those features shown as offline.

1. Copy `.env.example` to `.env.local` and fill in the project URL and anon key (Supabase → Project Settings → API).
2. Link the project and apply the schema: `npx supabase link --project-ref gfmxznmnclbsdenozrxd`, then `npm run db:push`.
   The migration copies likes from the old `user_saved_likes` table if it exists. The old tables are left alone.
3. Set the AI secrets and deploy the function:
   `npx supabase secrets set AI_INFERENCE_API_HOST=https://ai.borgwithus.xyz BORG_AI_MODEL=llama3.2:3b`, then `npm run ai:deploy`.
4. In Supabase → Authentication → URL Configuration, set the site URL to the production domain and allow `<domain>/login` as a redirect (used by confirmation emails).
5. Make yourself an admin in Supabase → SQL Editor:
   `insert into public.borg_admins (user_id) select id from auth.users where email = 'you@example.com';`
   Admins get "Dashboard" (`/admin`: 7/14/30/90-day ranges compared with the previous period — rolls by kind, signups and member growth, today's pace, roll mix, weekday pattern, member/engagement/review ratios, recent rolls and signups, most-liked names, and a daily numbers table) and "Review queue" (`/review`: approve or reject pending names) in the account menu.

Where things live:

- `supabase/migrations/` — `borg_likes` (one row per member and name), `borg_like_counts` (kept in sync by trigger, read by the leaderboard), `ai_credit_usage` plus the credit functions. Only the edge function can spend or refund credits.
- `supabase/migrations/…_borg_submissions.sql` — `borg_submissions` (member-sent names, `pending` until an admin approves or rejects them, unique by letters and digits across every status) and `borg_admins`. Neither table has grants; the site goes through `get_borg_wall()` (newest 12 approved, plus the caller's own pending and rejected), `get_borg_submission_quota()`, `submit_borg_name()`, `remove_borg_submission()` (frees that day's slot), and the admin-only `get_borg_review_queue()` and `review_borg_submission()`. Members without a name show as the first 8 characters of their account id.
- `supabase/migrations/…_borg_admin_dashboard.sql` — `borg_rolls` (every classic BORG/MIO roll, guests included, plus each BORG AI name; history copied from the old `user_rolls` table), `log_borg_roll()` (called by the generator for classic rolls) and the admin-only `get_admin_dashboard()`.
- `supabase/functions/generate-borg-name/` — checks the session, spends a credit, asks the Ollama model, refunds the credit if no usable name comes back, and logs each name it hands out to `borg_rolls`.
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
