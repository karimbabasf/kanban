# Color scheme prototype notes

Page: color-schemes.html (self-contained, opens from disk). Tokens: schemes.json (same names as src/styles.css :root, so a winner pastes in). Shots: shots/01.png to shots/10.png at 1440x900.

## Decisions

- Axis is color only. Markup and CSS are a static rebuild of Sidebar, Toolbar, Board, Inspector and HintBar from src/ui, with the CSS copied from src/styles.css. Each scheme only swaps the 27 color tokens (surfaces, inks, accent, red, five stocks, five swatches, hover, on-ink, scrim, shadows).
- Baseline "Paper and Ink" equals the current :root values, checked by script against src/styles.css (0 diffs on 2026-11-22).
- The schemes differ on structure, not only hue:
  - Paper and Ink: baseline, warm neutral, pastel stocks.
  - Oat and Pine: tinted warm ground, earthy stocks, brown-black ink.
  - Highlighter: achromatic white, bright saturated stocks, pure black ink.
  - Concrete: mid-value cool grey for low glare, big lane-to-card step.
  - Cyanotype: navy ink instead of black; lanes lighter than the ground (inverted step).
  - Carbon: near-black, flat steps, white ink.
  - Abyss: navy, big surface steps carry the hierarchy, softer ink.
  - Espresso: warm brown, lanes recessed below the ground.
  - Dim: mid-dark graphite, low contrast.
  - Jewel Box: green-black with deep saturated stocks.
- Accent (`--blue`) is the selection ring, focus outline, caret and selection wash only. The ring sits on the lane, so it is checked at 3:1 or more against lane, ground and card in every scheme.
- Text contrast: ink, ink-2, muted and red checked at 4.5:1 or more on every surface they sit on (ground, lane/sidebar, hover, card/inspector, all five stocks), plus button text on ink and on the button's kbd. All nine new schemes pass. The baseline fails one pair: muted on the hover fill, 4.41:1. Left as is because the baseline stays untouched.
- Stocks are kept apart in OKLab: at least 0.030 between any two stocks, and between a stock and the plain card or lane, in every new scheme (baseline: 0.023). Closest pair: Dim sky stock against the Dim card.
- Type: Google Sans Flex 500 from Google Fonts, normal style, no tracking, `font-optical-sizing: none`. Verified loaded in headless Chromium (`document.fonts.check` true, computed weight 500 everywhere).
- Dark schemes set `color-scheme: dark` on the screen so the native date picker icon and scrollbars follow.
- Interactions work in every scheme: click a card to select it, swatches recolor it, the lane segment moves it, search filters, board rows switch boards, density slider resizes, Today and clear set the due date, Delete removes. Checked over CDP: no exceptions, no console errors.

## Harness exceptions

- The picker is PICKER.md verbatim plus one extra rule, `.proto-picker { width: max-content; }`. The spec plans for at most 5 variants; with 10, `left: 50%` caps the pill at half the window and multi-word names wrapped to three lines. The rule sits outside the verbatim block with a comment.
- The app fills the window above an 84px neutral grey strip (#808080) that holds the picker, so the pill never covers the hint bar or the toolbar. Screen height in the shots is therefore 816px, not 900.
- No replay button: the comparison is static, so the shorter pill applies.
- Keys: 1 to 9 jump to schemes 1 to 9; scheme 10 is reached with the arrows or a click (the verbatim handler reads one digit).
- Traffic-light dots are drawn in the sidebar top for window context. They are OS colors, not scheme tokens.

## Known limits

- Four lanes, but only three show at 1440 with both panes open: lane-min at the default density (0.5) is 264px, so the board scrolls sideways to Done, exactly as the real app does. All five stocks, the overdue red on a stock and on a plain card, and the selected ring are inside the first three lanes.
- Swatch chips (`--ink-*`) are not held to 3:1 against the inspector. The yellow chip sits near 1.6 to 2.3:1 in the light schemes, same as the baseline (2.0:1).
- sloplint FAIL hits are all in the verbatim picker, the harness strip, the traffic lights, or the hallmark stamp rule. Spacing REFLEX hits are the app's own locked values.

## Rebuild

Scripts used (scratchpad, may be cleared): template.html plus build.mjs inject schemes.json into the page; check.mjs prints the contrast and OKLab tables; shots.sh takes the ten screenshots; interact.mjs drives the page over CDP.
