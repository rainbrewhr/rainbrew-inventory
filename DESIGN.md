# Design rules — Rainbrew Inventory System

These keep the app from drifting into generic "template" styling. Check a change against them before it ships.

**One accent.** Terracotta (`--accent`, text version `--accent-ink`) is the only brand accent. Green / amber / red are *status* colours, used only to say stock health or request state. "Received" is ink, "released" is the accent. No second hue.

**One grey family.** Warm browns only (`--bg`, `--panel`, `--panel2`, `--line`, `--mute`). No cool blue-greys.

**One radius scale.** 4 (micro: bars, tabs) · 8 (controls, rows, tags) · 12 (cards, tiles) · 20 (sheets, logo tile) · pill (chips, status, floating buttons) · circle (avatars). Nothing else.

**No decoration.** No glass / blur, no glows, no mesh or purple gradients, no confetti or sparkles. The only gradient is the rainbow hairline above the sidebar, because the logo has one.

**Icons, not emoji.** Every icon is from the inline icon set in `app.js`. No emoji or symbol characters as icons (plain `+` inside a `<select>` option is fine).

**One label per intent.** Receive = "Receive delivery". Request = "New request" (open the form) / "Send request" (submit). Buy = "Request to buy". Count = "Stock count". Waste = "Waste". Pages: Dashboard, Stock, Stock room, Buying, Requests, Records, Manage.

**Emphasis stays in the family.** Emphasise with weight or italic of the same typeface (the greeting name is Fraunces italic). Never drop a different font into a heading.

**Motion earns its place.** No animation on tab switches (used 100+ times a day). Press feedback is a quick scale-down on press-in. Popups and the side panel animate in under 300 ms. Everything respects reduced motion.

**Readable.** Text contrast at least 4.5:1 on both themes. Tap targets at least 44 px on phones. Quantities use tabular numerals and thousands separators (18,000).

**Every state is designed.** Loading shapes match the screen they stand in for. Empty states say how to fill them. Errors are inline and specific (offline has its own message).

**Back button.** Every popup, side panel and phone menu owns one history entry (`ovOpen` / `ovRelease` in `app.js`), so Back closes the top-most one before it leaves the app. Phone sheets and the side panel can be swiped away.

**Optimistic only after the server agrees.** Stock numbers never change on screen before the database confirms; once it does, the new balance shows immediately and the catalog refreshes in the background. Pressing a tab warms the catalog so the next screen opens faster.
