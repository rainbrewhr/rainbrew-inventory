# Typography

## Choosing type
- Pick for this subject and platform. On native mobile the system font (SF Pro / Roboto) is often the right call because it inherits Dynamic Type, optical sizing, and platform familiarity. Use a custom face only when it carries real brand meaning.
- Reflex picks that mark a page as generated: Inter, Roboto, Arial/Helvetica, bare system-ui, Space Grotesk, Playfair Display, DM Sans, and a lone monospace for "technical" flavor. They are fine when chosen, not when defaulted.
- One family or two. If two, make them structurally different (serif + sans), not near-twins. Use weight, width, and size range inside a family before adding another.
- Pair by role: display, body, and only if needed data/code.
- Real fallback stack always. Load only the weights used (usually 2-3).

## Setting type
- **Scale:** choose a ratio (about 1.2-1.333 for UI, up to 1.5 editorial) and stay on it. One display size per screen.
- **Line length:** under about 75 characters for body; serifs tolerate a bit more.
- **Line height:** about 1.4-1.6 body (a little more for serif), 1.05-1.25 headlines.
- **Letter-spacing:** slightly negative at large display sizes, slightly positive for small uppercase, otherwise leave it. Never track out lowercase body.
- **Weight:** real weights used with purpose. Avoid light weights at small sizes; avoid bold everywhere.
- **Alignment:** left-align body. Center only short isolated lines. Justify only with hyphenation and a wide measure.
- **Numerals:** tabular figures for tables, prices, timers, counters; proportional in prose.
- **Punctuation:** curly quotes and apostrophes, real ellipses, en dashes for ranges, non-breaking spaces where a break would hurt.
- **Size and contrast:** body at least 16px on web (iOS body is 17pt); secondary text still 4.5:1.
- **Dynamic text:** layouts must survive the largest accessibility text sizes.

## Tells to avoid
- Accenting one word in every headline with a different style, color, or typeface.
- ALL-CAPS tracked-out labels and eyebrow labels that just restate the heading.
- Gradient text as default emphasis.
- A new font size for every element; five weights on one screen; centered paragraphs; headlines that wrap to a single orphan word.
- Treating type as a neutral container when it is the visual. If type is the hero, make scale, weight contrast, cropping, or alignment part of the design.
