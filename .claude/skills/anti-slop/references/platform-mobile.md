# Mobile platform notes (iOS / Android / cross-platform)

Read the app's `DESIGN.md` for the stack. These laws hold across stacks; translate API names to the stack in use.

## Native fidelity
1. **Semantic colors, both themes, day one.** Use system or token-based colors that adapt to light and dark. Verify both before calling a screen done. Resolve semantic colors to plain values before handing them to animation libraries that can't take them.
2. **Native controls over rebuilt ones.** Switch, slider, segmented control, date picker, context menu. A rebuilt toggle that animates slightly differently from the OS reads as fake instantly.
3. **System icon set** (SF Symbols / Material Symbols). One icon family per app.
4. **Platform type ramp.** Large Title / Title / Headline / Body / Footnote on iOS; Material type roles on Android. One display size per screen.
5. **Continuous corners** where the platform supports them (iOS squircle). Cheapest "feels native" win.
6. **Safe areas, notch/Dynamic Island, and home indicator are part of the design.** Check content scrolled under the status bar and that bottom CTAs clear the home indicator. Never hard-code inset numbers.
7. **Navigation titles belong to the navigator.** Use the stack's native title and large-title collapse before hand-rolling a header.
8. **Haptics as punctuation.** Selection tick when a value passes a step, light impact when something snaps home, success/error for outcomes. One per action, same frame as the visual. Never on scroll or in loops.
9. **Scroll root.** Any screen that can overflow gets a scroll container as the root, with automatic inset adjustment. Use the window-size hook, not static dimension reads.
10. **Lists virtualize.** Stable keys, recycling, right-sized images with placeholders.

## Navigation
- iOS edge-swipe back and Android hardware/gesture back must work everywhere except the two blocked cases in the main skill.
- Sheets with detents and drag-to-dismiss for short interruptions; full modals for multi-step tasks.
- A sheet that grows a second step was a modal all along. If a link could open it, it's a route, not local state.
- Protected routes for one-way doors (auth, onboarding, purchase) so back can't re-enter the old state. Android back from home exits the app, never shows Login.
- Splash held until session state resolves; no Login flash before Home.

## Perceived performance
- Taps reflect instantly (optimistic update), reconcile in the background, roll back visibly on failure.
- Skeletons only when the shape is known; never a full-screen spinner for a partial update.
- Preload the next screen's data on press-in.
- Server state in a query cache; small atomic stores for client state; ephemeral UI state stays local. Uncontrolled text inputs for high-frequency typing.
- Measure performance on a **release build on the slowest device you support**. Dev builds and Expo Go hide the jank.

## Stack-specific notes
These go stale quickly. Prefer the project's own docs and the versions in its `package.json`. If `DESIGN.md` lists a stack, put stack-specific rules (library choices, API names) there, not here.
