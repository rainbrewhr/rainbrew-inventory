# Rainbrew Inventory System

Four mobile-friendly apps on one Supabase database. Static files, no build step: edit, commit, and GitHub Pages serves them.

One app, `index.html`: everyone signs in once and sees the screens their role allows (Admin: everything; Stock Keeper and Procurement: operations, buying and reports; Station Staff and Requester: requests and stock levels). The old `admin.html`, `stockkeeper.html`, `procurement.html` and `request.html` links forward here so installed icons keep working. It is installable from the home screen (`manifest.webmanifest`; `sw.js` caches the app shell). The React "Executive view" lives at `inventory/`.

## Accounts
Anyone can create an account and says what they do. "Request items for my station" is usable immediately (role Requester); stock keeper, procurement and admin requests wait for an admin to approve them in **Users**.
First-time setup: create an account choosing "Admin / first-time setup", confirm the email, sign in, and press **Set me up as the first admin** (works only while no admin exists).

## Files
- `config.js` — Supabase URL and publishable key (safe in the repo; row-level security protects the data)
- `app.js`, `style.css` — the shared client; `vendor/supabase.js` — supabase-js 2.45.4
- `supabase/migrations/002_app_functions.sql` — sign-up approval + the atomic actions (release, receive, count, waste, request)

Stock is never typed in: it is the sum of `stock_movements`, so every change is traceable to a request or count ID.
