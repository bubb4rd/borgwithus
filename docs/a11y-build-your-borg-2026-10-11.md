# Visual accessibility review: Build your Borg on mobile, 2026-10-11

Scope: only what you can see on the "jug" generator (`src/components/JugConfigurator.jsx` + `.css`) at
phone widths. No code was changed. Screen readers, keyboard-only use and the rest of the page were
out of scope.

Method: the attached full-page phone screenshot (402 px wide, signed in, BORG AI tab), plus the
local dev build in headless Chromium at 390×844 and 320×640 with the `jug` variant forced (signed
out; `log_*` RPCs blocked so nothing reached the A/B dashboard). Contrast is WCAG 2.x relative
luminance, measured against the panel base `--ink-soft` (#1c1b21). The flavour glow in the top-right
corner of the panel shifts a few values slightly.

## What it is on a 390 px phone

| | Measured |
|---|---|
| Jug photo (stage) | 406 px tall |
| Control panel | 764 px tall |
| Whole section | 1174 px, viewport 844 px |
| Controls in the panel, signed in on BORG AI | 17: 2 toggle halves, theme input, Ask, 👍, 👎, Learn more, Surprise me, 7 swatches, Save, Share |
| Text styles in the panel | display (Anton) at 4 sizes, mono uppercase at 9 / 10 / 11 / 12 px, body sans at 14–15 px |

The jug and the controls never fit on screen together. While someone picks a MiO the jug they're
dyeing is about 400–700 px above them, so the main reward (watching the pour) happens off screen.

## What's working

- **Three named steps** (Name it / Dye it / Keep it) separated by rules. Chunking it like this is
  the right call for cognitive load.
- **Swatches don't rely on colour alone.** Each has a text label, and the selected one changes in
  three ways: a paper ring, a lighter tile and a bold paper label.
- **Main targets are big enough.** BORG! is 44 px, the 👍/👎 pair 48 px, the theme input 48 px, Save and Share 56 px.
- **Focus ring**: 3 px `--acid` on the panel is 5.98:1. That passes (L1 in the main audit covers
  paper backgrounds, not this panel).
- **Body copy contrast**: `--paper-dim` on the panel is 10.27:1, and the active toggle is 16.6:1.
- **Reduced motion is handled**, including the thinking state, swaps, pops and hover lifts.
- **Save explains why it's disabled**: "Roll a name and pick a Mio to save your jug."
- **The name stays readable in every flavour.** Its colour is lifted to OKLCH L ≥ 0.74, so Black
  Cherry and Berry Grape still show on ink.
- **No layout jumps.** `AutoHeight` animates late content in (credits, errors) instead of shifting the page.

## Findings

Severity: **high** = content is unreadable or a control is unreachable; **medium** = fails or
nearly fails WCAG 2.2 AA, or adds a lot of load; **low** = polish.

| # | Sev | Finding | Evidence | WCAG |
|---|---|---|---|---|
| V1 | high | The **"No Mio yet" tag on the photo can't be read**: its text renders `rgba(15,14,18,0.28)` on an 80% ink pill, **1.15:1**. The cause is a class collision. The tag gets `is-empty`, and the global `.is-empty { color: rgba(15,14,18,.28) }` in `App.css:737` (meant for the paper label) overrides the inherited paper colour. The tag is the only on-photo status, and it's blank until a MiO is picked. | Computed style on `.jug-tag`; visible in the attached screenshot | 1.4.3 |
| V2 | high (UX) | **The preview is off screen while you build.** The section is 1174 px in an 844 px viewport, and the photo sits above every control. The tap → pour → name-writes loop is the core feedback, and on phones nobody sees it unless they scroll back up. | Measured heights above | — (cognitive; COGA "make the purpose clear") |
| V3 | medium | **Share is clipped at 320 px.** Its right edge is at x=322 inside a panel that ends at x=290, and `.jug-config { overflow: hidden }` cuts off 32 px. It only shows when `navigator.canShare` supports files, which is typical on phones. | 320×640 measurement | 1.4.10 Reflow |
| V4 | medium | **The empty-state name looks like a heading but reads as disabled.** "Roll a name" / "Ask BORG AI" is 28% paper, **2.35:1**. It's the biggest text in the step, so it competes with the step label and still fails the 3:1 large-text minimum. | `.jug-name.is-empty` (`JugConfigurator.css:305`) | 1.4.3 |
| V5 | medium | **The theme input's edge is hard to see.** Its border is 16% paper, **1.58:1**, and its fill barely differs from the panel. The placeholder is 40% paper, **3.46:1** at 15 px. | `.jug-input` (`:448–463`) | 1.4.11, 1.4.3 |
| V6 | medium (UX) | **"BORG AI" appears four times in one step**: toggle label + Beta badge, the placeholder headline "Ask BORG AI", the Ask button, and "Learn more about BORG AI". The credits row (5 pips + "3 of 5 credits left today") and two disabled thumbs sit between the input and the Dye step. In the attached screenshot the Name step alone is about 40% of the panel. | Attached screenshot | — |
| V7 | medium (UX) | **Disabled Save is the loudest thing in Keep it.** At 45% opacity the acid pill is still the largest saturated shape in the panel, so the eye goes to a button that does nothing yet, while the reason why is 11 px mono under it. Disabled controls are exempt from contrast rules (text 2.32:1), so this is about attention, not compliance. | `.btn:disabled` (`App.css:1032`) | — |
| V8 | low | **Small mono uppercase text everywhere:** Beta badge 9 px, swatch labels 10 px, hint and "Please drink responsibly" 11 px, toggle / Surprise me / credits 12 px, all letter-spaced. WCAG sets no minimum size, but uppercase mono at 9–11 px is the hardest text here for low-vision readers. | Computed sizes | (1.4.4 if it fails to scale) |
| V9 | low | **Some drops nearly disappear on ink.** Black Cherry is **1.56:1** and Berry Grape **2.43:1** against the panel. The labels carry the meaning so this isn't a strict failure, but those two drops look like holes in the grid. At 320 px the swatches are 52 px wide and "STRAWBERRY WATERMELON" runs into "BERRY GRAPE". | Swatch colours from `data.mio` | 1.4.11 (advisory) |
| V10 | low | **Toggle halves (30 px tall) and Surprise me (33 px)** pass 2.5.8 (24 px) but fall short of the 44 px platform guideline. They sit right next to other targets, so mis-taps are likely. | Measured | 2.5.8 passes, 2.5.5 AAA fails |
| V11 | low | **Thumbs show before there's anything to rate**: two 48 px disabled circles at 35% (2.95:1). The code comment says that's deliberate, for discoverability. On a phone it's two more shapes to read past. | `AiNameForm` comment, `:423` | — (exempt) |
| V12 | low | **The thinking state stacks four animations at once**: a spinning gradient border, a pulsing sparkle, a shimmering word that swaps every 1.8 s, and bouncing dots. Reduced motion turns them all off, but the default is busy for a wait that can last up to about 100 s. | `.jug-ai-btn.is-thinking` and friends | 2.2.2 (loading indicators are generally exempt) |

## Suggestions, with tradeoffs

| For | Suggestion | Pros | Cons / risks |
|---|---|---|---|
| V1 | Scope the global `.is-empty` (e.g. `.label-name.is-empty`, `.label-flavour.is-empty`) or rename the tag's modifier. | One-line fix; no visual change elsewhere. | Check every other `.is-empty` user first (`App.css` relies on it for paper labels). |
| V2 | **Sticky mini-preview on phones**: a ~96–120 px crop of the jug pinned at the top of the panel while the section is in view, showing the current name and MiO. | Keeps the feedback loop visible; makes the whole section feel like a single tool. | Stacks with the sticky nav (needs `top` offset); a second canvas draw or a scaled copy; less room per scroll. |
| V2 | Alternative: shrink the stage on phones (aspect 4/4.8 → ~4/3) and put Dye it above Name it. | Simplest change, no sticky behaviour. | Smaller hero photo; changes the step order the A/B test is measuring. |
| V2, V6 | **One step open at a time** (accordion/stepper) under ~600 px. Finished steps collapse to a summary row ("Name: Sponge Borg ✎"). | Biggest cut in visible controls (17 → about 5–9); clear next action. | More taps; hides choices; it's a layout change in the middle of an A/B test, so the comparison won't be clean. |
| V6 | Thin out the AI step: put the credit count in the Ask button ("Ask · 3 left") or as one line of text instead of 5 pips; drop the "Ask BORG AI" placeholder headline in AI mode; move "Beta" off the toggle and into the Learn-more link. | Removes three repeats and a row. | Pips are glanceable; one line of text is less playful. |
| V11 | Show the thumbs only once there's a name (pop in, as they already do). | Two fewer dead targets on first view. | Loses the "you can rate these" hint the code comment wants; a one-time tooltip could replace it. |
| V4 | Make the empty state readable: `--paper-dim` (10:1) in a smaller size, or an instruction ("Tap BORG! for a name"), not a 28% headline. | Passes 1.4.3; tells people what to do. | Less of the "blank label" look. |
| V5 | Input border at ≥45% paper (~3:1+), placeholder at ≥60% (~4.5:1). | Passes 1.4.11 / 1.4.3. | Slightly heavier look on the dark panel. |
| V7 | Until the jug is ready, render Save as an outline/ghost (not dimmed acid) and put the hint *above* the buttons; switch to solid acid when ready. | The first saturated thing on screen is something you can tap; becoming solid is a clear "done" signal. | Loses the anticipation of the dimmed acid pill. |
| V3 | Let `.jug-actions` wrap (or stack full-width) below ~360 px. | Fixes the clipping. | Adds ~68 px of height on small phones. |
| V8 | 12 px minimum for mono text, 11 px for the Beta badge, or switch labels to sentence case at the same size. | Readable without zooming. | Swatch labels may need 2 lines more often; mono uppercase is part of the brand. |
| V9 | Give every drop a constant 1 px `--rule`/paper hairline; at ≤360 px, use 3-column swatches or a single horizontal scroll-snap row. | Dark flavours stay visible; labels stop colliding. | Scroll row hides options off screen (needs an edge fade so people know it scrolls). |
| V10 | Pad the toggle halves and Surprise me to ≥40–44 px tall on touch (`@media (pointer: coarse)`). | Fewer mis-taps. | Name step gets ~20 px taller, which works against V6 unless paired with it. |
| V12 | Keep one cue by default (the word swap or the dots) and drop the spinning border + shimmer. | Calmer during long waits. | Less "alive" feel; the chat-app status-line idea gets weaker. |

## Suggested order

1. V1 (bug, one line) and V3 (reflow).
2. V4 + V5 (contrast fixes that don't change the layout).
3. V2 / V6 / V7 (the "overwhelming" problem). These change the layout, so either run them as a
   new arm of the generator A/B test or ship them after it ends, so the current comparison stays
   clean.
4. V8–V12 polish.

## Not checked

- The signed-in BORG AI state live (no login). The AI rows come from the attached screenshot and the CSS.
- Screen reader output. One code note: `.jug-name` is an `aria-live` region that's remounted on
  every change (`key={name?.text …}`), and remounted live regions are often not announced.
- Text-only zoom at 200%. Setting a 200% root font size in the headless run changed nothing,
  so the result is unknown.
