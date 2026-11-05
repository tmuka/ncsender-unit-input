// From QuickCut's tests/unit-input.test.cjs (the same parser).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseUnitValue, unitValueProblem } = require('../dist/unit-input.cjs');

const METRIC = false, IMPERIAL = true;

test('plain numbers pass through untouched in either unit system', () => {
  assert.equal(parseUnitValue('6.35', METRIC, 'length'), 6.35);
  assert.equal(parseUnitValue('.25', IMPERIAL, 'length'), 0.25);
  assert.equal(parseUnitValue(' -30 ', METRIC, 'length'), -30);
  assert.equal(parseUnitValue('3.14159', METRIC, 'length'), 3.14159);
});

test('inch input converts to mm on a metric machine', () => {
  assert.equal(parseUnitValue('.25in', METRIC, 'length'), 6.35);
  assert.equal(parseUnitValue('.25"', METRIC, 'length'), 6.35);
  assert.equal(parseUnitValue('0.25 inch', METRIC, 'length'), 6.35);
  assert.equal(parseUnitValue('1/4"', METRIC, 'length'), 6.35);
  assert.equal(parseUnitValue('1-1/2"', METRIC, 'length'), 38.1);
  // Fractions over 1 work too.
  assert.equal(parseUnitValue('5/4"', METRIC, 'length'), 31.75);
  assert.equal(parseUnitValue('5/4"', IMPERIAL, 'length'), 1.25);
  assert.equal(parseUnitValue('1 1/2 in', METRIC, 'length'), 38.1);
  assert.equal(parseUnitValue('1/4”', METRIC, 'length'), 6.35);
});

test('mm/cm input converts to inches on an imperial machine', () => {
  assert.equal(parseUnitValue('6.35mm', IMPERIAL, 'length'), 0.25);
  assert.equal(parseUnitValue('6.35 MM', IMPERIAL, 'length'), 0.25);
  assert.equal(parseUnitValue('2.54cm', IMPERIAL, 'length'), 1);
  assert.equal(parseUnitValue('3mm', IMPERIAL, 'length'), 0.1181);
});

test('fractions with no unit stay in the active units', () => {
  assert.equal(parseUnitValue('1/4', IMPERIAL, 'length'), 0.25);
  assert.equal(parseUnitValue('-1-1/2', IMPERIAL, 'length'), -1.5);
});

test('feed fields accept per-minute units', () => {
  assert.equal(parseUnitValue('100ipm', METRIC, 'feed'), 2540);
  assert.equal(parseUnitValue('100 in/min', METRIC, 'feed'), 2540);
  assert.equal(parseUnitValue('2540 mm/min', IMPERIAL, 'feed'), 100);
  assert.equal(parseUnitValue('600mm', IMPERIAL, 'feed'), 23.622);
  assert.equal(parseUnitValue('100ipm', METRIC, 'length'), null, 'ipm is a feed unit only');
});

test('feed fields accept /m as per minute and per-second units', () => {
  assert.equal(parseUnitValue('1500mm/m', IMPERIAL, 'feed'), 59.0551);
  assert.equal(parseUnitValue('1500 mm/m', METRIC, 'feed'), 1500);
  assert.equal(parseUnitValue('60in/m', METRIC, 'feed'), 1524);
  assert.equal(parseUnitValue('25mm/s', IMPERIAL, 'feed'), 59.0551);
  assert.equal(parseUnitValue('25 mm/sec', METRIC, 'feed'), 1500);
  assert.equal(parseUnitValue('1ips', METRIC, 'feed'), 1524);
  assert.equal(parseUnitValue('1 in/s', IMPERIAL, 'feed'), 60);
  assert.equal(parseUnitValue('0.5in/sec', IMPERIAL, 'feed'), 30);
  assert.equal(parseUnitValue('25mm/s', METRIC, 'length'), null, 'per-second units are feed-only');
  assert.equal(parseUnitValue('25mm/h', METRIC, 'feed'), null);
});

test('unreadable text returns null', () => {
  for (const bad of ['', 'abc', '1/0', '1-1/0', '6.35 furlongs', '1..2', '--1']) {
    assert.equal(parseUnitValue(bad, METRIC, 'length'), null, JSON.stringify(bad));
  }
});

// From Spoilboard Toolbox's tests (the math).
test('parseUnitValue: simple math, with or without units', () => {
  const M = false, I = true;
  assert.equal(parseUnitValue('8mm*2', M, 'length'), 16);
  assert.equal(parseUnitValue('8mm * 2', I, 'length'), 0.6299);
  assert.equal(parseUnitValue('12/6', M, 'length'), 2);
  assert.equal(parseUnitValue('4+6', M, 'length'), 10);
  assert.equal(parseUnitValue('4+6', I, 'length'), 10);
  assert.equal(parseUnitValue('1in+4mm', M, 'length'), 29.4);
  assert.equal(parseUnitValue('1in+4mm', I, 'length'), 1.1575);
  assert.equal(parseUnitValue('1in+4', M, 'length'), 29.4, 'a bare number added is in the machine units');
  assert.equal(parseUnitValue('1in+1', I, 'length'), 2);
  assert.equal(parseUnitValue('(1/4"+2mm)/2', M, 'length'), 4.175);
  assert.equal(parseUnitValue('2*(3+4)', M, 'length'), 14);
  assert.equal(parseUnitValue('-2mm+10', M, 'length'), 8);
  assert.equal(parseUnitValue('61mm-38.1', M, 'length'), 22.9);
  assert.equal(parseUnitValue('3/4" - 1/8"', M, 'length'), 15.875);
  assert.equal(parseUnitValue('100ipm*1.5', M, 'feed'), 3810);
  assert.equal(parseUnitValue('1500mm/min/2', M, 'feed'), 750);
  // Single values still read as before.
  assert.equal(parseUnitValue('1-1/2"', M, 'length'), 38.1);
  assert.equal(parseUnitValue('1/4in', M, 'length'), 6.35);
  // Nonsense stays unreadable.
  assert.equal(parseUnitValue('1.5/2', M, 'length'), 0.75);
  assert.equal(parseUnitValue('1/4/2', M, 'length'), 0.125);
  assert.equal(parseUnitValue('2/4mm', I, 'length'), 0.0197);
  for (const bad of ['8mm*2mm', '2/in', '1in/2mm', '4/0', '4+', '(4+6', '4)', '2in*3ipm', '4 4', 'abc', '1in/min*2']) {
    assert.equal(parseUnitValue(bad, M, 'length'), null, bad);
  }
});

test('a decimal comma reads as a point, but not a thousands separator', () => {
  assert.equal(parseUnitValue('1,5mm', false, 'length'), 1.5);
  assert.equal(parseUnitValue(',25in', false, 'length'), 6.35);
  assert.equal(parseUnitValue('1,25', false, 'length'), 1.25);
  assert.equal(parseUnitValue('1,2345', false, 'length'), 1.2345);
  for (const t of ['1,000', '2,540', '1,500 mm/min', '1,000mm', '2+1,000']) {
    assert.equal(parseUnitValue(t, false, 'feed'), null, t);
  }
  assert.equal(unitValueProblem('1,000'), '1,000 could be 1000 or 1.000: write 1000, or 1,0 for a decimal');
  assert.equal(unitValueProblem('6,350mm'), '6,350 could be 6350 or 6.350: write 6350, or 6,35 for a decimal');
  assert.equal(unitValueProblem('1,5mm'), null);
  assert.equal(unitValueProblem('abc'), null);
});
