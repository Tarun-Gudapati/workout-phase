# Jin-Woo Build

Gym-tracking PWA: workout quests, progression targets, weekly check-ins and the Phase 1 diet plan.
Plain HTML/CSS/JS, no build step, deployed as a static site on Vercel.

Run locally: `python3 -m http.server 8080` and open http://localhost:8080.

With `js/config.js` empty the app is local-only: the log lives in this browser and moves between devices
with Log → Export / Import backup. Filling in `js/config.js` adds accounts, sync and the coach view.

## Cloud setup

1. **Create a project** at [supabase.com](https://supabase.com) → New project.
2. **Run the migration.** SQL Editor → New query → paste all of `supabase/migrations/0001_init.sql` → Run.
   It is safe to run again after changes.
3. **Auth settings.**
   - Authentication → Sign In / Providers → **Email**: enabled. "Confirm email" can stay on.
   - Authentication → URL Configuration → **Site URL**: `https://<your-app>.vercel.app`.
     **Redirect URLs**: `https://<your-app>.vercel.app/**` and `http://localhost:8080/**`.
   - Authentication → Emails → Templates: in **Confirm signup** and **Reset password** add
     `<p>Your code: {{ .Token }}</p>`. The app asks for this code, so sign-up and password reset work inside
     the installed iPhone app (email links open in Safari, which has separate storage).
   - Supabase's built-in email sender allows only a few emails per hour. Before inviting several people, add
     your own SMTP server (Authentication → Emails → SMTP Settings).
4. **Connect the app.** Project Settings → API Keys / Data API: copy the **Project URL** and the **anon
   (publishable) key** into `js/config.js`:
   ```js
   window.APP_CONFIG = { supabaseUrl: "https://xxxx.supabase.co", supabaseAnonKey: "eyJ..." };
   ```
   The anon key is safe to commit because row level security protects every table.
   Never put the `service_role` / secret key in the app.
5. **Deploy**: commit and push; Vercel publishes it. Open the app once online so the new files are cached.
6. **Promote a coach** (after that person has signed up), in the SQL Editor:
   ```sql
   update profiles set role = 'coach' where id = (select id from auth.users where email = lower('coach@example.com'));
   ```
   The coach reloads the app and gets a Coach tab with their code. Athletes enter it under Account → Coach.

On first sign-in, a device with an existing local log offers to upload it to the account (merged, nothing is
overwritten). The old data is also kept in this browser's localStorage as `jw.gym.v1.backup-<time>`.

### How sync works

- The app always renders from localStorage (one key per account, `jw.gym.v1:<user id>`), so it works offline.
- Every change gets a timestamp and goes into an outbox. Deletions become tombstones until the server has them.
- Sync pulls rows changed since the last pull (by server time), merges them, then uploads the outbox.
  When two devices edit the same workout or check-in, the newer edit wins. Draft, exercise swaps and settings
  merge separately.
- Sync runs on sign-in, 2 s after a change, when the connection returns, when the app comes to the
  foreground, and every minute. Failures retry with backoff, and nothing leaves the outbox until the server
  confirms it.
- Coaches have read-only access to linked athletes' workouts, check-ins and calorie settings. The coach view
  loads live and needs a connection.

Local Supabase for development (needs Docker): from the repo root run `npx supabase init` and
`npx supabase start` (it applies `supabase/migrations/0001_init.sql`), then put the printed API URL and anon
key in `js/config.js`. Do not commit them.
