---
name: anti-slop
description: Keeps apps and their writing from looking and sounding generic or AI-made. Use whenever the user asks Claude to design, build, restyle, polish, or critique any interface (mobile or web apps, screens, flows, onboarding, paywalls, dashboards, landing pages, components, slides), to choose fonts, colors, or layout, to write UI copy or any prose (emails, docs, READMEs, marketing), or says things like "make it feel native", "less generic", "looks templated", "make it sound human", "cut the fluff", "polish this", "fix the typography". Works for any stack and is meant to be paired with a per-app brief (DESIGN.md) so each app keeps its own identity. Apply proactively to any substantial UI or writing Claude produces, even if the user never mentions style.
license: MIT
metadata:
  version: 2.0.0
---

# Anti-Slop

Slop is work that came from no one in particular: the statistical average of every app and every article. It is interchangeable, padded, and formulaic, and users file it under "template" within seconds.

The cure has two halves:

1. **Make choices for this specific app, audience, and job.** A brief records those choices so they stay consistent.
2. **Cut everything that doesn't serve them.**

This skill is general. The specifics of each app (accent, type, voice, navigation grammar, stack) live in that app's `DESIGN.md`. Never invent them fresh on every screen.

## Step 0: Load or create the app brief

Look for `DESIGN.md` at the project root (or ask the user where the app's design decisions live).

- **If it exists:** read it first. Its decisions are locks. Follow them exactly, including when they conflict with the defaults below.
- **If it doesn't exist:** before designing anything substantial, propose one using [references/app-brief-template.md](references/app-brief-template.md). Fill it from what you already know (code, existing screens, conversation). Ask the user at most three questions, only about what you can't infer (usually: who it's for, what feeling it should have, and a reference app they admire). State assumptions for the rest, get a yes, and save the file.
- **For a one-off tweak** (fix this padding, reword this button), don't build a brief. Infer the locks from the existing code and match them.

When the user's request, the brief, and this skill disagree, the order of authority is: the user's explicit words, then `DESIGN.md`, then this skill.

## Step 1: Study before you draw

Don't design a screen from imagination when you can study how good products solved the same problem.

1. Gather references for the screen type: screenshots the user has, a reference-library tool if one is connected (for example the Appllama MCP), or web search. Aim for 10-20 examples for a significant screen, fewer for small ones.
2. Extract the **pattern, not the pixels**: layout skeleton, information hierarchy, control choices, spacing rhythm, where the primary action sits, how progress is shown, what gets illustration versus plain text. If a reference carries a watermark or provenance mark, ignore it and never reproduce it.
3. Design **your** screen with the proven skeleton in your app's voice. Copying a competitor 1:1 is lazy and legally risky. Ignoring every convention users already know is worse.

## Step 2: The laws

Each law is a **default**, not a dogma. Break one only when the brief or user asks AND you can say in a sentence why it fits this product.

### Visual system
1. **No AI-default styling.** Purple/indigo gradient buttons with a glow, glassmorphism on every card, mesh-gradient heroes, sparkles, confetti for minor events, and the cream-background-serif-terracotta look are the model's house style, not design. Palette, materials, and layout come from the brief and references.
2. **One accent, locked.** One accent color, used where the value is: primary action, active state, progress. Neutrals carry the rest. No new hue appearing on screen seven.
3. **One grey family.** Warm or cool, never both. Tint near-black deliberately, don't default to #0B0B0B or #111.
4. **Shape lock.** One corner-radius scale stated as a rule ("actions are pills, cards 16, inputs 8") and never violated.
5. **One elevation system.** Shadows express layering, not decoration. Same recipe throughout.
6. **Spacing rhythm.** One base unit (4 or 8), one scale. Consistent inside groups, generous around the primary element.
7. **Icons from one family.** No emoji as iconography unless the product's voice is genuinely playful or chat-native, and then only in content, never in chrome.
8. **Structure is information.** Borders, dividers, eyebrows, numbering, and labels must encode something about the content. Numbered markers (01/02/03) only for real sequences. Cut anything that only decorates.
9. **Spend boldness in one place.** One memorable element, everything near it quiet.
10. **No SaaS-card kit.** Not every group of content needs to become identical rounded cards with the same soft shadow.

### Typography
Details in [references/typography.md](references/typography.md). The short version:
- Choose type for this subject, not your reflex families (Inter, Roboto, Arial, Space Grotesk, Playfair as a first instinct). Platform-native system fonts are a legitimate, often best, choice for native apps.
- One family or two. If two, make them clearly distinct. Use weight and size range before adding a family.
- One scale, one display size per screen, body line length under about 75 characters, tabular numerals wherever numbers align or change.
- Emphasize inside the family (weight or italic of the same face). Don't accent one word per headline in a different style or color. No tracked-out ALL-CAPS labels on everything.

### Words in the product
Details in [references/writing.md](references/writing.md). The short version:
- **One label per intent.** "Get started", "Start now", and "Begin" are one intent: pick one phrase and use it everywhere.
- Buttons say what will happen ("Save changes", not "Submit"). The same action keeps its name through the flow (button "Publish", toast "Published").
- Errors say what went wrong and how to fix it, in place. No apologies, no "Something went wrong."
- Empty states say how to fill them. Sentence case, plain verbs, active voice.
- Lead with substance, be specific, say it once, commit instead of hedging. Cut stock vocabulary ("seamless", "unlock", "elevate", "delve") and formulas ("It's not just X, it's Y").
- Realistic content: no "John Doe", "Acme", lorem ipsum, or round fake numbers. Format numbers like a product (1.4M, $4.99).

### Flow and navigation
Every transition answers three questions: where does this go, must the user be able to come back, and what does back do afterward.
- **Push goes deeper, replace moves on.** Back undoes navigation, never events.
- **Presentation is meaning.** Multi-step task → modal with its own Cancel/Done. Short interruption → sheet. Floating confirm → overlay. Destructive confirm → action sheet. Item actions → context menu. Share/photo/web → the system's own control.
- **One-way doors leave the stack.** After sign-in, finished onboarding, a purchase, or a completed session, back must not re-enter the old state. Keep the user's place when an action triggered the door (sign-in from "save" returns to save).
- **Block back in exactly two cases:** an irreversible request in flight, and unsaved work in a modal. Anything else that traps back is a defect.
- **Tabs are peers.** No slide between tabs; each keeps its own stack; re-tapping pops to root.
- **One primary action per screen.** Secondary actions look secondary.
- Deep links land with a real stack underneath. Cold start waits for session state, never flashing Login before Home.

### Motion
Motion is the highest-leverage polish surface and the easiest to overdo.
- **Frequency gate first.** Seen 100+ times a day (tab switch, keyboard, scroll, back) → platform default, nothing custom. Tens a day (press, row select) → barely perceptible, under 150 ms. Occasional (sheets, toasts) → standard motion. Delight only on rare, first-time moments. When unsure, delete the animation.
- **Name the purpose in one word:** feedback, spatial continuity, state change, avoiding a jarring cut, explanation, or delight. No purpose, no animation. Data the user is reading never moves for style.
- **If a finger was involved, use a spring** that starts from the live value and inherits release velocity. Otherwise use short timing under 300 ms, strong ease-out for entrances, faster exits.
- **No scattered ambient motion:** no fade-and-slide-up on every section, no hover-lift on every card. One orchestrated moment beats ten effects.
- **Respect Reduce Motion:** spatial motion becomes a cross-fade.

### States and robustness
- Design every state: loading (skeletons matching the final layout, only when the shape is known), empty, error, long content, offline, partial data, and success. The happy path alone is the default failure mode.
- Light and dark mode both work on day one, using semantic color tokens, not hard-coded hex per screen.
- Accessibility floor: 4.5:1 text contrast (3:1 large text and UI), 44px/pt touch targets, visible keyboard/focus state, scalable text that doesn't break layout, labels on every control, screen-reader names on icon-only buttons.
- Feedback for every action. Haptics (mobile) are punctuation: one per action on the same frame as the visual, never the only feedback, never on scroll.

## Step 3: Mechanical pre-flight

Before calling anything finished, count against the brief. A failed count is a fix, not a judgment call.

| Check | Target |
|---|---|
| Distinct accent hues | 1 (or the number the brief states) |
| Distinct corner radii | all from the brief's scale |
| Neutral families | 1 |
| Typefaces | per brief (usually 1-2) |
| Distinct font sizes | all from the type scale |
| Emoji in UI chrome | 0 |
| Gradients without a brand reason | 0 |
| Duplicate labels for one intent | 0 |
| Stock vocabulary / filler openers in copy | 0 |
| Screens with more than one primary action | 0 |

## Step 4: See it running

A screen doesn't exist until you've seen it running. Layout can be checked from screenshots, but motion, navigation, and keyboard behavior can't.

1. Run it (simulator, emulator, browser, dev server).
2. Screenshot and look: alignment, optical centering, truncation with long content, dark mode, large text size, small and large viewports.
3. Walk the whole flow, not just the screen: every back path, every one-way door, every modal and sheet (including cancelling mid-drag), the keyboard appearing and dismissing, rapid taps.
4. Hunt for one-frame flashes (unstyled first paint, wrong-theme frames), layout jumps, and dropped frames.
5. Fix, rerun, and stop when you can't find a flaw, not when it "looks fine."

If you can't run the app in this environment, say so, review the code against the laws, and list what still needs checking on a device. Don't claim a screen is verified from code review alone. Full checklist: [references/verification.md](references/verification.md).

## Definition of done (per screen)

- [ ] `DESIGN.md` exists and the screen follows it
- [ ] References studied; you can name the pattern you adopted
- [ ] Navigation answered: what this screen is, what back does, and one-way doors can't be re-entered
- [ ] All states designed: loading, empty, error, long content
- [ ] Light and dark verified
- [ ] Copy follows the app's voice and label vocabulary
- [ ] Accessibility floor met
- [ ] Pre-flight counts pass
- [ ] Seen running, including motion and the full flow, with no flaws found

## References

| File | Load when |
|---|---|
| [references/app-brief-template.md](references/app-brief-template.md) | No `DESIGN.md` exists, or the user wants to define/refine an app's identity |
| [references/typography.md](references/typography.md) | Choosing fonts, setting a type scale, fixing text that looks off |
| [references/writing.md](references/writing.md) | Writing or editing any prose or UI copy |
| [references/platform-mobile.md](references/platform-mobile.md) | iOS/Android or cross-platform mobile apps (React Native/Expo, SwiftUI, Compose, Flutter) |
| [references/platform-web.md](references/platform-web.md) | Websites, web apps, landing pages, dashboards |
| [references/verification.md](references/verification.md) | Final check before calling a flow done |

Don't mention this skill or announce that you removed slop. Just deliver the work.
