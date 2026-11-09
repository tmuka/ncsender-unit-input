/**
 * Unit-aware number fields for ncSender plugins (from QuickCut).
 *
 * Plugins keep lengths in mm and show them in the machine's units (inches
 * when ncSender's unitsPreference is 'imperial'). An operator can type a
 * value in either unit and it is converted:
 *   6.35        -> 6.35 (no unit: already in the machine's units)
 *   math too: 8mm*2  4+6  1in+4mm  (1/4"+2mm)/2
 *   .25in  .25"  1/4"  1-1/2"  1 1/2 in  6.35mm  0.635cm
 *   feeds also: 100ipm  100 in/min  2540 mm/min  1500mm/m
 *               42.333mm/s  1.667ips  (per second -> per minute)
 *
 * Written as plain ES5 functions so the same text can be pasted into a
 * plugin's config.html (dist/unit-input.global.js), required from Node
 * (dist/unit-input.cjs) or imported and bundled (this file).
 */

export var MM_PER_INCH = 25.4;

// What's typed into a length or feed field, in mm or inches whatever the
// machine uses, as a number in the machine's units (inches when imperial,
// else mm): 6.35, 1/4", 1-1/2 in, 6.35mm, 0.635cm; feeds also 100ipm,
// 2540 mm/min, 1.667ips. No unit means the machine's units already. null
// when it can't be read. QuickCut's parser (parseUnitQuantity), plus
// simple math from Spoilboard Toolbox (parseUnitMath) when it isn't a single value.
export function parseUnitValue(text, isImperial, kind) {
  // A decimal comma (1,5mm, ,25in) reads as a point, but not one before
  // exactly three digits: 1,000 or 2,540 may be a thousands separator, and
  // 1 or 2.54 instead would be quietly wrong, so that's unreadable. After a
  // 0 (0,125) it can only be a decimal.
  text = String(text == null ? '' : text);
  if (THOUSANDS.test(text)) return null;
  text = text.replace(/,/g, '.');
  var one = parseUnitQuantity(text, isImperial, kind);
  return one !== null ? one : parseUnitMath(text, isImperial, kind);
}
// Why parseUnitValue can't read text, when it's a comma before exactly three
// digits: a message to show the operator, e.g. "1,000 could be 1000 or
// 1.000: write 1000, or 1,0 for a decimal". null otherwise.
export function unitValueProblem(text) {
  var m = THOUSANDS.exec(String(text == null ? '' : text));
  if (!m) return null;
  // The decimal with the comma shortened (1,0), or with a point when it can't be (1.125).
  var short = m[3].replace(/0+$/, '') || '0';
  return m[2] + ',' + m[3] + ' could be ' + m[2] + m[3] + ' or ' + m[2] + '.' + m[3] + ': write ' + m[2] + m[3] + ', or ' +
    (short.length < 3 ? m[2] + ',' + short : m[2] + '.' + m[3]) + ' for a decimal';
}
// A comma that may be a thousands separator: digits not starting with 0, a
// comma, exactly three digits.
var THOUSANDS = /(^|[^\d])([1-9]\d*),(\d{3})(?!\d)/;
// mm per unit (per minute for feeds) of the units a field takes.
export function unitMmPer(kind) {
  var MM_PER = { mm: 1, cm: 10, 'in': 25.4, inch: 25.4, inches: 25.4, '"': 25.4 };
  if (kind === 'feed') {
    // Per minute (what G94 feeds use); "/m" is read as per minute.
    MM_PER['mm/min'] = 1;
    MM_PER['mm/m'] = 1;
    MM_PER['in/min'] = 25.4;
    MM_PER['in/m'] = 25.4;
    MM_PER['inch/min'] = 25.4;
    MM_PER.ipm = 25.4;
    // Per second, scaled to per minute.
    MM_PER['mm/s'] = 60;
    MM_PER['mm/sec'] = 60;
    MM_PER['in/s'] = 25.4 * 60;
    MM_PER['in/sec'] = 25.4 * 60;
    MM_PER.ips = 25.4 * 60;
  }
  return MM_PER;
}
// Simple math in a field, as CAD tools allow: + - * / and brackets, each
// number with or without a unit: 8mm*2, 4+6, 1in+4mm, (1/4"+2mm)/2. A
// number without a unit is in the machine's units when added or
// subtracted, else a plain factor. null when it can't be read, or for a
// length times a length or anything divided by a length or by 0.
export function parseUnitMath(text, isImperial, kind) {
  var s = String(text == null ? '' : text).trim().toLowerCase().replace(/[”″]/g, '"').replace(/''/g, '"');
  var per = unitMmPer(kind), k = isImperial ? 25.4 : 1, i = 0;
  var ws = function() { while (s[i] === ' ') i++; };
  // A number, a fraction (1/4) and a unit: { v: mm, or the bare number;
  // d: 1 for a length (or feed), 0 for a plain number }.
  var quantity = function() {
    var m = /^(?:(\d+)\/(\d+)(?![\d.])|(\d+(?:\.\d*)?|\.\d+))\s*([a-z"]+(?:\/[a-z]+)?)?/.exec(s.slice(i));
    if (!m || +m[2] === 0) return null;
    i += m[0].length;
    var v = m[1] != null ? m[1] / m[2] : parseFloat(m[3]);
    if (!m[4]) return { v: v, d: 0 };
    return Object.prototype.hasOwnProperty.call(per, m[4]) ? { v: v * per[m[4]], d: 1 } : null;
  };
  var expr;
  var factor = function(signed) {
    ws();
    if (!signed && (s[i] === '-' || s[i] === '+')) {
      var neg = s[i++] === '-', f = factor(true);
      return f && { v: neg ? -f.v : f.v, d: f.d };
    }
    if (s[i] !== '(') return quantity();
    i++;
    var e = expr();
    ws();
    if (!e || s[i] !== ')') return null;
    i++;
    return e;
  };
  var term = function() {
    var a = factor();
    for (;;) {
      ws();
      var op = s[i];
      if (op !== '*' && op !== '/') return a;
      i++;
      var b = factor();
      if (!a || !b) return null;
      if (op === '*') { if (a.d + b.d > 1) return null; a = { v: a.v * b.v, d: a.d + b.d }; }
      else { if (b.d || b.v === 0) return null; a = { v: a.v / b.v, d: a.d }; }
    }
  };
  expr = function() {
    var a = term();
    for (;;) {
      ws();
      var op = s[i];
      if (op !== '+' && op !== '-') return a;
      i++;
      var b = term();
      if (!a || !b) return null;
      if (a.d !== b.d) { if (a.d) b = { v: b.v * k, d: 1 }; else a = { v: a.v * k, d: 1 }; }
      a = { v: op === '+' ? a.v + b.v : a.v - b.v, d: a.d };
    }
  };
  var r = expr();
  ws();
  if (!r || i < s.length || !isFinite(r.v)) return null;
  return parseFloat((r.d ? r.v / k : r.v).toFixed(isImperial ? 4 : 3));
}
export function parseUnitQuantity(text, isImperial, kind) {
  var t = String(text == null ? '' : text).trim().toLowerCase()
    .replace(/[”″]/g, '"').replace(/''/g, '"');
  var m = t.match(/^([+-])?\s*(\d+(?:\.\d*)?|\.\d+)(?:(?:\s+|-)(\d+)\/(\d+)|\/(\d+))?\s*([a-z"/]*)$/);
  if (!m) return null;
  var whole = parseFloat(m[2]);
  var value;
  if (m[3] != null) {
    // Mixed number: 1-1/2 or 1 1/2. The whole part must be an integer.
    if (/\./.test(m[2]) || +m[4] === 0) return null;
    value = whole + (+m[3]) / (+m[4]);
  } else if (m[5] != null) {
    // Plain fraction: 1/4.
    if (/\./.test(m[2]) || +m[5] === 0) return null;
    value = whole / (+m[5]);
  } else {
    value = whole;
  }
  if (m[1] === '-') value = -value;

  var MM_PER = unitMmPer(kind);
  var unit = m[6];
  if (!unit) return value;
  if (!Object.prototype.hasOwnProperty.call(MM_PER, unit)) return null;
  var mm = value * MM_PER[unit];
  var out = isImperial ? mm / 25.4 : mm;
  return parseFloat(out.toFixed(isImperial ? 4 : 3));
}

/** Rounds for showing: 4 decimals in inches (sub-thou), 3 in mm. */
export function roundDisplay(v, isImperial) {
  return parseFloat(v.toFixed(isImperial ? 4 : 3));
}

/** mm to the active units (not rounded). */
export function mmToDisplay(mm, isImperial) {
  return isImperial ? mm / MM_PER_INCH : mm;
}

/**
 * The active units back to mm. In inches it gives the shortest mm number
 * that shows as the same inches, so a value that started in mm comes back
 * as it was (6 mm shows as 0.2362 in and returns as 6, not 5.99948), and
 * a real inch value stays exact (0.25 in is 6.35).
 */
export function displayToMm(val, isImperial) {
  if (!isImperial) return val;
  var mm = val * MM_PER_INCH, shown = roundDisplay(val, true);
  for (var d = 0; d <= 4; d++) {
    var r = parseFloat(mm.toFixed(d));
    if (roundDisplay(r / MM_PER_INCH, true) === shown) return r;
  }
  return mm;
}

/** A mm value as field text in the active units: 6 -> "6" or "0.2362". */
export function formatMm(mm, isImperial) {
  return String(roundDisplay(mmToDisplay(mm, isImperial), isImperial));
}

/**
 * Typed text to mm (lengths) or mm/min (feeds), whatever unit was typed;
 * a plain number is in the active units. null when unreadable.
 */
export function textToMm(text, isImperial, kind) {
  var v = parseUnitValue(text, isImperial, kind);
  return v == null ? null : displayToMm(v, isImperial);
}

/**
 * A default given in mm, snapped to a round inch size for an imperial
 * machine: 0.005 under 1/16, then 1/16 under 1, 1/8 under 4, 1/2 above
 * (so 3 mm shows as 0.125, not 0.1181).
 */
export function roundInches(inch) {
  var a = Math.abs(inch), step = a < 0.0625 ? 0.005 : a < 1 ? 1 / 16 : a < 4 ? 1 / 8 : 1 / 2;
  return a ? Math.sign(inch) * Math.max(step, Math.round(a / step) * step) : 0;
}

/**
 * Makes every field under `root` that has a data-unit attribute
 * ("length" or "feed") work like QuickCut's:
 * - Leaving it (or Enter) rewrites what was typed as a plain number in the
 *   active units ("6mm" -> 0.2362 on an inch machine) and fires `input`.
 *   It listens for blur (not focusout, which fires after the field's own
 *   blur) in the capture phase on root, so the plugin's own blur,
 *   focusout and Enter handlers see the plain number.
 * - Up / Down step the value like Chrome DevTools: 1, Shift 10, Alt
 *   (Option) 0.1, Ctrl (Command) 0.001, in the field's units. A step never
 *   goes under the field's min (data-min or min): it stops at a whole
 *   minimum and doesn't move for an odd one. data-integer steps by 1 or
 *   more. Each step fires `input`, then calls opts.onStep(el).
 * Fields should be type="text" (a number input drops 1/4" before JS sees
 * it). opts.imperial: a boolean, or a function read each time.
 * Returns a function that removes the listeners.
 */
export function wireUnitFields(root, opts) {
  opts = opts || {};
  function imperial() {
    return typeof opts.imperial === 'function' ? !!opts.imperial() : !!opts.imperial;
  }
  function unitField(el) {
    return el && el.getAttribute && el.tagName === 'INPUT' && el.getAttribute('data-unit') ? el : null;
  }
  function normalize(el) {
    var v = parseUnitValue(el.value, imperial(), el.getAttribute('data-unit'));
    if (v == null || String(v) === el.value.trim()) return;
    el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function onBlur(evt) {
    var el = unitField(evt.target);
    if (el) normalize(el);
  }
  function onKeyDown(evt) {
    var el = unitField(evt.target);
    if (!el || el.disabled || el.readOnly) return;
    if (evt.key === 'Enter') { normalize(el); return; }
    if (opts.arrows === false || (evt.key !== 'ArrowUp' && evt.key !== 'ArrowDown')) return;
    var imp = imperial();
    var current = parseUnitValue(el.value, imp, el.getAttribute('data-unit'));
    if (current == null || !isFinite(current)) current = 0;
    var step = evt.ctrlKey || evt.metaKey ? 0.001 : (evt.shiftKey ? 10 : (evt.altKey ? 0.1 : 1));
    if (el.hasAttribute('data-integer')) step = Math.max(1, step);
    var next = current + (evt.key === 'ArrowUp' ? step : -step);
    var min = parseFloat(el.getAttribute('data-min') != null ? el.getAttribute('data-min') : el.getAttribute('min'));
    if (isFinite(min) && next < min) {
      if (!Number.isInteger(min)) { evt.preventDefault(); return; }
      next = min;
    }
    next = parseFloat(next.toFixed(imp ? 4 : 3));
    evt.preventDefault();
    if (String(next) === el.value) return;
    el.value = next;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    if (opts.onStep) opts.onStep(el);
  }
  root.addEventListener('blur', onBlur, true);
  root.addEventListener('keydown', onKeyDown, true);
  return function unwire() {
    root.removeEventListener('blur', onBlur, true);
    root.removeEventListener('keydown', onKeyDown, true);
  };
}
