# Rainbrew Inventory

Four mobile-friendly apps on one Supabase database. Static files, no build step: edit, commit, and GitHub Pages serves them.

| App | Page | Who |
|---|---|---|
| Admin | `admin.html` | Admin (dashboard, release, receive, buy list, waste, count, items, users, history) |
| Stock Keeper | `stockkeeper.html` | Admin, Stock Keeper |
| Procurement | `procurement.html` | Admin, Stock Keeper, Procurement Officer |
| Request | `request.html` | Admin, Stock Keeper, Station Staff, Requester |

`index.html` is the launcher. Each app is a Home Screen installable web app (`*.webmanifest`, `sw.js` caches the app shell).

## Accounts
Anyone can create an account from any app. Request-app accounts are usable immediately (role Requester). Accounts made in the other three apps wait for an admin to approve them in **Admin → Users**.
First-time setup: create an account in the Admin app, confirm the email, sign in, and press **Set me up as the first admin** (works only while no admin exists).

## Files
- `config.js` — Supabase URL and publishable key (safe in the repo; row-level security protects the data)
- `app.js`, `style.css` — the shared client; `vendor/supabase.js` — supabase-js 2.45.4
- `supabase/migrations/002_app_functions.sql` — sign-up approval + the atomic actions (release, receive, count, waste, request)

Stock is never typed in: it is the sum of `stock_movements`, so every change is traceable to a request or count ID.
