# ncsender-unit-input

Number fields for ncSender plugins that take any unit. Type a value in mm
or inches, whatever the machine uses, and it becomes the machine's units:

| Typed | Metric machine | Inch machine |
|---|---|---|
| `6.35` | 6.35 | 6.35 (no unit: already the machine's) |
| `1/4"`, `.25in`, `1-1/2"`, `1 1/2 in` | 6.35, 6.35, 38.1, 38.1 | 0.25, 0.25, 1.5, 1.5 |
| `6.35mm`, `0.635cm` | 6.35 | 0.25 |
| `8mm*2`, `1in+4mm`, `(1/4"+2mm)/2` | 16, 29.4, 4.175 | 0.6299, 1.1575, 0.1644 |
| `1,5mm`, `,25in` (decimal comma) | 1.5, 6.35 | 0.0591, 0.25 |
| feeds: `100ipm`, `2540 mm/min`, `25mm/s` | 2540, 2540, 1500 | 100, 100, 59.0551 |

From QuickCut's `lib/unit-input.cjs` (the parser) and Spoilboard Toolbox (the
math), so every plugin reads fields the same way instead of keeping its own copy.

## Use

Bundled plugins (esbuild):

```js
import { wireUnitFields, textToMm, formatMm } from 'ncsender-unit-input';

const imperial = settings.unitsPreference === 'imperial';
// <input type="text" data-unit="length" min="0" value="${formatMm(thicknessMm, imperial)}">
wireUnitFields(root, { imperial: () => imperial });
// in your blur or focusout handler (change fires before the conversion):
const mm = textToMm(input.value, imperial); // null when unreadable
```

Plugins without a build: load or paste `dist/unit-input.global.js`; it sets
`window.NcUnitInput` with the same functions. Node tests: `require('ncsender-unit-input')`.

## API

- `parseUnitValue(text, isImperial, kind)`: typed text to a number in the
  machine's units (4 decimals in inches, 3 in mm). `kind` is `'length'` or
  `'feed'` (per minute). `null` when it can't be read.
- `textToMm(text, isImperial, kind)`: the same in mm (or mm/min).
- `formatMm(mm, isImperial)`: a mm value as field text in the machine's units.
- `displayToMm(v, isImperial)`, `mmToDisplay(mm, isImperial)`,
  `roundDisplay(v, isImperial)`: conversions; `displayToMm` gives back the
  shortest mm that shows the same (6 mm -> 0.2362 in -> 6 mm).
- `roundInches(inch)`: snaps a mm default to a shop size in inches
  (3 mm -> 0.125).
- `wireUnitFields(root, { imperial, arrows = true, onStep })`: for every
  `input[data-unit]` under `root`:
  - leaving the field or Enter rewrites the text as a plain number and fires
    `input` (capture phase, so your own handlers see the number);
  - Up / Down step 1, Shift 10, Alt 0.1, Ctrl/Cmd 0.001, never under
    `data-min` / `min`; `data-integer` steps whole numbers.

  Use `type="text"`: a number input drops `1/4"` before JS sees it. Returns
  a function that removes the listeners.

## Develop

Edit `src/unit-input.js`, then `npm run build` (writes `dist/`) and `npm test`
(the tests also fail when `dist/` is out of date).

GPL-3.0, like the plugins it came from.
