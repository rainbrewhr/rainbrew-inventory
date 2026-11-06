# App Brief Template (DESIGN.md)

Save as `DESIGN.md` at the project root. Keep it to one page. Every line is a decision someone could violate by accident; if a line isn't a decision, delete it. Mark guesses with "(assumed)" until the user confirms.

```markdown
# <App name> design brief

## What this is
- Subject: <one concrete sentence: what the app does>
- Audience: <who, in what situation, on what device>
- Primary job: <the one thing a user must accomplish>
- Feeling: <3 adjectives, plus 1 thing it must NOT feel like>
- Reference apps: <2-4 apps to study, and what to take from each>

## Platform and stack
- Targets: <iOS / Android / web / all>
- Stack: <e.g. Expo + Expo Router + Reanimated / Next.js + Tailwind / SwiftUI>
- Component library and icon set: <names; one icon family only>

## Visual locks
- Accent: <hex, light and dark> - used for: <primary action, active state, progress>
- Neutrals: <warm or cool; background / surface / border / text hexes or token names>
- Semantic: <success, warning, error hexes>
- Radius scale: <e.g. pills for actions, 16 cards, 8 inputs>
- Elevation: <e.g. none, or one shadow recipe, and where it applies>
- Spacing: <base unit and scale>
- Imagery / illustration style: <one style, one palette, or "none">

## Type
- Families and roles: <e.g. display: X, body: Y, data: tabular figures>
- Scale: <ratio or list of sizes>
- Rules: <e.g. no all-caps labels; emphasis via weight only>

## Voice
- Tone: <e.g. plain, warm, a little dry>
- Person and tense: <you/we, active voice>
- Label vocabulary (one phrase per intent): <Get started / Save changes / Publish / Delete>
- Never say: <words and phrases specific to this brand>
- Number and date formats: <1.4M, $4.99, locale dates>

## Navigation grammar
- Structure: <tabs / stack / sidebar; list the tabs>
- Modals vs sheets vs overlays: <what uses which>
- One-way doors: <sign-in, onboarding, purchase, ...>
- Deep link rules: <...>

## Motion
- Signature moment: <the single memorable animation, or "none">
- Spring/timing vocabulary: <e.g. settle 400 ms damping 1; sheets 300 ms damping 0.8>
- Reduce Motion behavior: <cross-fade>

## Deliberate exceptions
- <Any default from the anti-slop skill this app breaks on purpose, and why>
```

## Filling it in
- Prefer inferring from the repo (theme files, tokens, existing screens) over asking.
- If the app has no look yet, propose 2 distinct directions in a sentence each and let the user pick. Don't blend them.
- After the user confirms, treat the file as law. If a later request conflicts with it, point out the conflict and ask whether to update the brief or make a one-off exception.
