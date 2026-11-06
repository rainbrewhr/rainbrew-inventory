# Verification checklist

Run after the flow works. Check with real content, not lorem ipsum.

## Per screen
- [ ] Light and dark, no wrong-token surfaces
- [ ] Smallest and largest supported viewport; landscape if supported
- [ ] Largest text size: nothing clipped or overlapping
- [ ] Long names, long numbers, many items, one item, zero items
- [ ] Loading (matching skeleton), error (specific, inline, recoverable), offline
- [ ] Safe areas / notches / home indicator / sticky bars don't cover content
- [ ] Touch targets 44px/pt; every icon-only control has an accessible name
- [ ] Contrast passes in both themes
- [ ] Copy uses the app's label vocabulary; no filler or stock phrases

## Per flow (run it, don't read it)
- [ ] Walk it end to end; record it if you can
- [ ] Every back path: UI back, edge swipe, hardware back, browser back
- [ ] After each one-way door, back can't re-enter the old state
- [ ] Every modal/sheet: open, drag, dismiss, cancel mid-drag
- [ ] Keyboard: opens (focused input stays visible), dismisses without a jump
- [ ] Rapid taps, interrupted gestures, scroll flings at the extremes
- [ ] Watch once at full speed for feel, once frame by frame for defects
- [ ] Look for: flashes of unstyled or wrong-theme content, layout jumps, springs that clip or overshoot, elements that reflow after appearing, dropped frames

## Mechanical counts (from the main skill)
Accent hues, corner radii, neutral families, typefaces, font sizes, emoji in chrome, unjustified gradients, duplicate labels, filler phrases, multiple primary actions.

## If you can't run it
Say so plainly. Review code against the laws, list exactly what still needs a device or browser check, and don't call the screen verified.
