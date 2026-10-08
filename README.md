# Fretboard.js

A dependency-free, plain-JavaScript plugin that renders a guitar fretboard as SVG and labels every note on it. No build step, no framework — drop in two files and call one constructor.

## Features

- Two render modes: `realistic` (default) for the new instrument finish, or `diagram` for the original flat style.
- In realistic mode: subtle SVG wood grain, a shaded surface and edge, metallic fret wires, layered strings, and clearer note markers with a ring around root notes.
- Renders the full fretboard — nut, frets, strings, and standard dot inlays — as a single inline SVG.
- Labels every fret with its actual note name, computed from the tuning you pass in (not hardcoded per-string offsets), so any tuning works correctly, including the guitar's one irregular interval between the G and B strings.
- Any number of strings — the string count is always `tuning.length`, so ukulele, 4-string bass, and 8-string guitar all work the same way as standard 6-string guitar. See "Any number of strings" below.
- Optional scale/chord highlighting: pass a set of notes and a root, and only those notes are shown, with the root visually distinguished.
- Scale-degree labels (`1`, `b3`, `5`, ...) relative to a highlighted root, as an alternative to note names.
- Configurable fret-spacing taper (see below) to draw either perfectly even frets or a real-guitar-style narrowing taper, at any strength.
- Left-handed mode: mirror the whole board both horizontally (nut on the right) and vertically (string order reversed, low string on top).
- Sharp or flat spelling for accidentals (`preferFlats`).
- Theming via CSS custom properties — no need to touch the SVG-generation code to reskin it.
- Zero dependencies. No build tooling required to use it.

## Getting started

Copy `fretboard.js` and `fretboard.css` into your project and include them:

```html
<link rel="stylesheet" href="fretboard.css" />
<script src="fretboard.js"></script>
```

Then construct a fretboard against any container element:

```html
<div id="fretboard-container"></div>
<script>
  const fb = new Fretboard(document.getElementById('fretboard-container'), {
    frets: 12,
    renderMode: 'realistic', // or 'diagram'
    tuning: ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'], // low to high
  });
</script>
```

Open `index.html` in this folder for a live, interactive demo with tuning, fret count, taper, left-handed, note-label, and highlight controls.

### Module usage

`fretboard.js` also exports via `module.exports` if you're using it in a CommonJS/bundled environment:

```js
const Fretboard = require('./fretboard.js');
```

Otherwise it attaches itself to `window.Fretboard` when loaded as a plain `<script>` tag.

## Constructor options

```js
new Fretboard(container, {
  frets: 12,
  renderMode: 'realistic',  // 'realistic' | 'diagram'
  tuning: ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'], // low to high; any string count works — see "Any number of strings" below
  leftHanded: false,       // true mirrors the board — see "Left-handed mode" below
  showOpenStrings: true,
  labelMode: 'note',       // 'note' | 'degree' | 'none'
  preferFlats: false,
  highlight: null,         // e.g. { notes: ['C', 'E', 'G'], root: 'C' }
  fretTaper: 0,            // see "Fret spacing / taper" below
  fretWidth: 64,
  stringSpacing: 34,
  nutWidth: 14,
  padding: 28,
});
```

| Option | Default | Description |
|---|---|---|
| `frets` | `12` | Number of frets to draw. |
| `renderMode` | `'realistic'` | `'realistic'` uses the textured design; `'diagram'` uses the original flat design. Validated in the constructor, `setOptions()`, and `setRenderMode()`. |
| `tuning` | standard EADGBE | Array of note names, **low string to high string** (index 0 = lowest pitch). The number of strings drawn is always `tuning.length` — pass an array of any length. Accepts sharps or flats, e.g. `'F#3'`, `'Bb2'`. Must be a non-empty array; an empty array throws. |
| `leftHanded` | `false` | Mirrors the whole board horizontally — nut on the right, fret 1 next to it, frets increasing toward the left. See "Left-handed mode" below. |
| `showOpenStrings` | `true` | Draws a small zone to the left of the nut with each string's open-note label. In `leftHanded` mode, this zone (and its notes) correctly relocates to the right of the nut instead. |
| `labelMode` | `'note'` | `'note'` labels each fret with its note name; `'degree'` labels it with its scale degree relative to `highlight.root` (see "Scale-degree labels" below); `'none'` draws the board with no note labels at all. |
| `preferFlats` | `false` | When `true`, accidentals are spelled with flats (`Bb`) instead of sharps (`A#`). |
| `highlight` | `null` | `{ notes: [...], root: 'C' }` — when set, only matching notes are drawn, and the root is styled distinctly. Note-name matching is by pitch class, so `'C#'` and `'Db'` are treated as the same note. |
| `fretTaper` | `0` | Controls fret-spacing taper. See below. |
| `fretWidth` | `64` | Base horizontal spacing unit (px) between frets when `fretTaper` is `0`. |
| `stringSpacing` | `34` | Vertical distance (px) between adjacent strings. |
| `nutWidth` | `14` | Width (px) of the nut. |
| `padding` | `28` | Padding (px) around the whole diagram. |

### Render modes

```js
const fb = new Fretboard(container, {
  renderMode: 'diagram', // original flat design
  frets: 12,
});

fb.setRenderMode('realistic'); // switch to the new finish
fb.setOptions({ renderMode: 'diagram', frets: 15 });
```

| Mode | Appearance |
|---|---|
| `realistic` (default) | Wood grain, shaded edges, metallic frets and strings, note shadows, amber roots with a fine outer ring, and a small wood margin beyond the outer strings. |
| `diagram` | Original flat surface, brass fret wires, single-line strings, purple highlights, mint roots, and the original label styling, with extra clearance below the note circles for fret numbers. No texture, gradients, shadows, or root rings. |

Both modes retain the full-width background fix, tuning, highlighting, labels,
fret taper, and handedness. Changing modes updates the existing SVG and keeps
the other options. Each mode reserves space for its fret-number row. Diagram
mode places the number baseline 30 SVG units below the lowest string, leaving
clearance below the note circles and enough room at the bottom of the SVG.

Omitting `renderMode` (or passing `undefined`) selects `realistic`. Other values
besides the two supported strings throw before modifying the displayed board.

The main playground has an **Appearance → Render mode** selector. Copied
configuration includes the chosen mode, and SVG export retains its appearance.
Named theme presets use the corresponding mode's palette; manually customized
colors remain when switching. Reset restores the realistic Rosewood default.
The simpler `index_old.html` demo starts in diagram mode and also has a selector.

### Any number of strings

The number of strings drawn is always `tuning.length` — there's no separate "string count" option, so it can never disagree with the tuning you actually pass in. This means any plucked-string instrument works, not just 6-string guitar:

```js
// Ukulele — note this is given in true PITCH order (low to high), not the
// conventional "G C E A" playing order. Standard ukulele tuning is
// reentrant: the G string is tuned up an octave, so it isn't actually the
// lowest-pitched string, even though it's written first. Since tuning[0] is
// always drawn as the lowest, thickest string, using playing order here
// would visually misrepresent the instrument.
new Fretboard(container, { tuning: ['C4', 'E4', 'G4', 'A4'] });

// 4-string bass — one octave below a guitar's low four strings.
new Fretboard(container, { tuning: ['E1', 'A1', 'D2', 'G2'] });

// 8-string guitar — standard tuning extends 6-string EADGBE down by two
// more perfect fourths (verified against multiple independent sources).
new Fretboard(container, { tuning: ['F#1', 'B1', 'E2', 'A2', 'D3', 'G3', 'B3', 'E4'] });
```

A few things worth knowing:

- **`tuning` must be a non-empty array.** An empty array throws a clear error, both from the constructor and from `setTuning()` — there's no silent fallback, since a zero-length tuning would otherwise produce a negative, broken board height.
- **A single-string tuning is allowed.** Realistic mode adds a small wood margin above and below the string; diagram mode retains the original zero-height flat board.
- Everything else — note computation, highlighting, fret taper, left-handed mirroring — is completely independent of string count and works the same way regardless of how many strings are drawn.
- The board's height and each string's relative thickness scale automatically with the string count; there's nothing to configure separately.

The demo page's tuning dropdown includes ukulele, bass, and 8-string presets under "Other instruments."

### Left-handed mode

Setting `leftHanded: true` mirrors the entire board for a left-handed player, both horizontally and vertically:

- **Horizontally:** the nut moves to the right edge, fret 1 sits immediately to its left, and fret numbers increase moving leftward.
- **Vertically:** the string order is fully reversed too — the lowest-pitched string is drawn at the top instead of the bottom, and the highest-pitched string at the bottom instead of the top. For standard guitar tuning (E2 A2 D3 G3 B3 E4, low to high), the default top-to-bottom order is E4-B3-G3-D3-A2-E2; under `leftHanded` it's the exact reverse, E2-A2-D3-G3-B3-E4 — so the B string sits second from the very bottom, immediately above the high E4.

This is still computed as a coordinate transform, not a re-derivation:

- Note names, tuning, highlighting, and fret-spacing taper are computed exactly as normal and are completely unaffected — only where things are drawn changes, never what note is at what fret. In particular, the note at any given tuning index and fret is identical between `leftHanded: true` and `leftHanded: false`; only its drawn position moves.
- String thickness still correctly tracks pitch (the lowest string is always thickest), regardless of whether that string ends up drawn at the top or the bottom.
- It composes correctly with `fretTaper`: with a non-zero taper, frets still narrow moving away from the nut — it's just that the nut (and therefore the narrow end) is now on the right instead of the left. The vertical string reversal and the horizontal taper are independent of each other.
- Fret markers, note labels, and fret-number labels stay exactly aligned to the actual fret-wire positions in either mode, since both read from the same internal position calculation.
- Text (note names, fret numbers) is repositioned, not flipped — labels always read normally, never backwards.
- The open-string gutter (see `showOpenStrings`) correctly relocates to the opposite side, and the SVG's own bounds automatically size themselves to contain it there with the same margin it has in the default orientation — nothing clips.
- The vertical reversal applies at any string count — it isn't specific to 6-string guitar (see "Any number of strings" above).

```js
fb.setLeftHanded(true);
```

### Scale-degree labels

Setting `labelMode: 'degree'` labels each note with its scale degree (`1`, `b3`, `5`, and so on) relative to a root, instead of its note name:

- The root is taken from `highlight.root` — degree is inherently relative, so there's no meaningful "1" without a reference point to measure from.
- Degrees use the conventional scale-degree naming: `1, b2, 2, b3, 3, 4, b5, 5, b6, 6, b7, 7` for the twelve semitones above the root. Verified against real scale shapes — a C major highlight produces exactly `1` through `7` with no accidentals, and A minor pentatonic produces the well-known `1, b3, 4, 5, b7`.
- Root notes are still styled distinctly (see `--fb-root-bg` / `--fb-root-text` in Theming) and are always labeled `1`.
- **If there's no root to measure from** — `highlight` is `null`, or set but missing a `root` — degree mode falls back to plain note names rather than guessing a root or leaving labels blank.

```js
fb.setHighlight({ root: 'A', notes: ['A', 'C', 'D', 'E', 'G'] }); // A minor pentatonic
fb.setLabelMode('degree'); // labels become 1, b3, 4, 5, b7
```

### Fret spacing / taper

Real guitar frets aren't evenly spaced — each one is closer to the next than the last, narrowing toward the body. `fretTaper` controls how much of that effect is applied:

- **`0` (default, or omitted entirely)** — every fret is the same width (`fretWidth` apart). Nothing is tapered.
- **`1`** — true guitar fret spacing: the same equal-tempered curve (12 semitones per octave) that puts fret 12 at exactly half the scale length on a real instrument.
- **Above `1`** — exaggerates the taper further in the same direction, with no upper bound (e.g. `2.5` narrows more dramatically than a real guitar).
- **Negative values are not a defined shape.** `setFretTaper(taper)` validates this and throws if `taper` is negative, `NaN`, or not a number. The constructor does **not** currently perform this same check — passing a negative `fretTaper` directly in the constructor options is silently accepted and produces incorrect, non-monotonic spacing rather than a clean error. Stick to `fretTaper >= 0` at construction time, or set it afterward via `setFretTaper()` if you want the validation.

Whatever `fretTaper` is set to, the last fret always lands at the same horizontal position for a given `fretWidth`/`frets` pair — only the frets *between* the nut and the last fret reshape. Fret markers and note labels always stay aligned to the actual drawn fret positions, since both read from the same internal position calculation.

```js
fb.setFretTaper(1);   // true guitar taper
fb.setFretTaper(2.5); // more dramatic than real life
fb.setFretTaper(0);   // back to equidistant
```

## Public API

| Method | Description |
|---|---|
| `setRenderMode(mode)` | Switch between `'realistic'` and `'diagram'` and re-render. Invalid values throw before changing the board. |
| `setFrets(frets)` | Change the number of frets and re-render. |
| `setTuning(tuning)` | Change the tuning (array, low to high) and re-render. The new array can be a different length than the current one — string count always follows `tuning.length`. Throws if `tuning` isn't a non-empty array. |
| `setHighlight(highlight)` | Update the highlighted note set (or pass `null` to clear it) and re-render. |
| `setLabelMode(mode)` | Switch between `'note'`, `'degree'`, and `'none'` and re-render. |
| `setLeftHanded(leftHanded)` | Toggle left-handed (mirrored) mode and re-render. |
| `setFretTaper(taper)` | Change the fret-spacing taper and re-render. Throws if `taper` isn't a number `≥ 0`. Note: this validation only applies when calling the setter — the constructor does not validate `fretTaper` (see "Fret spacing / taper" above). |
| `setOptions(partialOptions)` | Merge any subset of constructor options and re-render in one call. |
| `getSVG()` | Returns the underlying `<svg>` element, e.g. for exporting or further manipulation. |
| `destroy()` | Removes the rendered SVG and clears the container. |

### Static helpers

`Fretboard.noteNameToMidi(name)` and `Fretboard.midiToNoteName(midi, preferFlats)` are exposed statically, in case a host page wants to build its own highlight sets (e.g. computing the notes of a scale) using the same note-naming logic the plugin uses internally.

## Theming

Colors remain CSS custom properties scoped to `.fretboard-svg`. In realistic mode, the default
finish pairs dark rosewood with muted green scale notes and warm amber roots.
The demo also includes Midnight and Maple presets plus custom color controls.

```css
.fretboard-svg {
  --fb-wood: #33251f;
  --fb-wood-edge: #160f0d;
  --fb-fretwire: #b6aaa0;
  --fb-nut: #eee4d2;
  --fb-string: #d6c7ac;
  --fb-inlay: rgba(238, 224, 198, 0.5);
  --fb-fret-number: #a69b89;
  --fb-note-bg: #40332c;
  --fb-note-border: #8c7764;
  --fb-note-text: #fff7e8;
  --fb-highlight-bg: #315d4c;
  --fb-highlight-border: #86b59c;
  --fb-root-bg: #edc27c;
  --fb-root-text: #302415;
  --fb-open-divider: rgba(214, 199, 172, 0.2);
  --fb-grain-opacity: 0.5;
}
```

Override any subset in a stylesheet loaded after `fretboard.css`, or scope the
rule to your container, for example `#my-fretboard .fretboard-svg`. For overrides
that apply to both modes, use that container scope or set variables inline on
the SVG. Diagram defaults use `.fretboard-svg[data-render-mode="diagram"]`.
Set
`--fb-grain-opacity: 0` for a smooth finish. The grain, shading, and highlights
are vector shapes: no images, fonts, or other assets need to be downloaded.
Each instance has its own SVG paint IDs so multiple boards can share a page.

In realistic mode the wood surface extends beyond the outer strings. Both modes
reach the final fret in either handedness layout. Note pitches and fret-center
positions remain the same across the modes.

The playground preserves readable note sizes on narrow screens by allowing
horizontal scrolling. Its **Download SVG** action copies resolved presentation
styles and explicit dimensions into the exported file, retaining the selected
colors and new surface details without requiring `fretboard.css` alongside it.
`getSVG()` still returns the live SVG element; it does not embed external styles.

## Known limitations

- **`fretTaper` is only validated via `setFretTaper()`, not the constructor.** Passing a negative `fretTaper` in the constructor options doesn't throw — it silently produces incorrect, non-monotonic fret spacing. Always pass `fretTaper >= 0` at construction time.
- No package-manager distribution (npm, etc.) — this is plain files meant to be copied into a project.

## Browser support

Uses standard `document.createElementNS` SVG construction and ES5-compatible syntax — no transpilation required. Works in any browser with SVG and CSS custom property support (i.e. anything reasonably current).

## License

MIT — see [LICENSE](./LICENSE).
