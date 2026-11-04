const { test } = require('node:test');
const assert = require('node:assert/strict');
const U = require('../dist/unit-input.cjs');

test('mm shown in the active units and read back unchanged', () => {
  assert.equal(U.formatMm(6, false), '6');
  assert.equal(U.formatMm(6, true), '0.2362');
  assert.equal(U.displayToMm(0.2362, true), 6, '6 mm round-trips through inches');
  assert.equal(U.displayToMm(0.25, true), 6.35, 'a real inch size stays exact');
  assert.equal(U.displayToMm(12.5, false), 12.5);
});

test('textToMm: any typed unit to mm', () => {
  assert.equal(U.textToMm('1/4"', false), 6.35);
  assert.equal(U.textToMm('1/4"', true), 6.35);
  assert.equal(U.textToMm('6mm', true), 6);
  assert.equal(U.textToMm('0.5', true), 12.7, 'plain numbers are in the active units');
  assert.equal(U.textToMm('12', false), 12);
  assert.equal(U.textToMm('100ipm', false, 'feed'), 2540);
  assert.equal(U.textToMm('abc', true), null);
});

test('roundInches snaps mm defaults to shop sizes', () => {
  assert.equal(U.roundInches(3 / 25.4), 0.125);
  assert.equal(U.roundInches(0.03), 0.03);
  assert.equal(U.roundInches(50 / 25.4), 2);
  assert.equal(U.roundInches(0), 0);
});

test('the global build sets window.NcUnitInput with the same functions', () => {
  const fs = require('node:fs'), vm = require('node:vm');
  const window = {};
  vm.runInNewContext(fs.readFileSync(__dirname + '/../dist/unit-input.global.js', 'utf8'), { window });
  assert.deepEqual(Object.keys(window.NcUnitInput).sort(), Object.keys(U).sort());
  assert.equal(window.NcUnitInput.parseUnitValue('1/4"', false), 6.35);
});

test('a decimal comma reads as a point', () => {
  const { parseUnitValue } = U;
  assert.equal(parseUnitValue('1,5mm', false), 1.5);
  assert.equal(parseUnitValue('0,25in', false), 6.35);
  assert.equal(parseUnitValue(',5', true), 0.5);
  assert.equal(parseUnitValue('12,5', false), 12.5);
  assert.equal(U.textToMm('6,35mm', true), 6.35);
});
