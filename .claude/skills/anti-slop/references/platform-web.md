# Web platform notes

## Layout and structure
- Responsive from 320px up. Design the narrow layout first, then enhance. Wide content (tables, code) scrolls inside its own container; the page body never scrolls sideways.
- Real landmarks and headings (`header`, `nav`, `main`, one `h1`). Semantic elements before ARIA.
- Pick a max content width and stick to it; don't let body text stretch across a wide monitor.
- Hero: open with the most characteristic thing in the subject's world (headline, image, live demo, interactive moment). Big number + small label + stat row + gradient is the default treatment, so use it only if it is truly right.

## Visual
- Define color, type, spacing, radius, and shadow as CSS variables (design tokens) from `DESIGN.md`. No one-off hex values in components.
- Support light and dark with `prefers-color-scheme`, and set `color-scheme`.
- Avoid the generated-page kit: identical rounded cards, same soft shadow, gradient washes, glow blobs, three-column icon-in-circle features, eyebrow labels above every heading, `->` on every link.
- Remote images and fonts need fallbacks, dimensions to prevent layout shift, and descriptive alt text.

## Interaction
- Every interactive element has hover, focus-visible, active, and disabled states. Never remove the focus outline without a replacement.
- Forms: visible labels (not placeholder-only), correct `type` and `autocomplete`, inline validation on blur, errors tied to fields with `aria-describedby`.
- Respect `prefers-reduced-motion`.
- Click targets at least 44px on touch.
- Links navigate, buttons act. Don't use a `div` as a button.

## Performance
- Ship little JavaScript. Lazy-load below-the-fold media. Set image dimensions. Preload the one font weight that renders above the fold; avoid layout shift from font swap.
- Check Core Web Vitals (LCP, CLS, INP) on a throttled mobile profile, not just a fast laptop.

## CSS hygiene
- Watch selector specificity. Generic section classes and element selectors can cancel each other (especially padding/margin between sections). Prefer a flat, low-specificity structure.
- Spacing from one scale; use `gap` over stacked margins.
