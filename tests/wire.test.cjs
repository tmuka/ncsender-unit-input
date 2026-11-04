// wireUnitFields with a tiny stand-in for the DOM (no browser needed).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { wireUnitFields } = require('../dist/unit-input.cjs');

function fakeRoot() {
  const handlers = {};
  return {
    handlers,
    addEventListener: (type, fn, capture) => { assert.equal(capture, true); (handlers[type] ||= []).push(fn); },
    removeEventListener: (type, fn) => { handlers[type] = (handlers[type] || []).filter((f) => f !== fn); },
    fire(type, evt) { for (const fn of handlers[type] || []) fn(evt); },
  };
}
function field(value, attrs = {}) {
  const a = { 'data-unit': 'length', ...attrs };
  return {
    tagName: 'INPUT', value, disabled: false, readOnly: false, events: [],
    getAttribute: (k) => (k in a ? a[k] : null),
    hasAttribute: (k) => k in a,
    dispatchEvent(e) { this.events.push(e.type); },
  };
}
const key = (target, k, mods = {}) => ({ target, key: k, preventDefault() { this.prevented = true; }, ...mods });

test('leaving a field rewrites typed units as the machine units', () => {
  const root = fakeRoot();
  wireUnitFields(root, { imperial: true });
  const el = field('6.35mm');
  root.fire('focusout', { target: el });
  assert.equal(el.value, 0.25);
  assert.deepEqual(el.events, ['input']);
  const plain = field('0.25');
  root.fire('focusout', { target: plain });
  assert.equal(plain.value, '0.25');
  assert.deepEqual(plain.events, [], 'a plain number is left alone');
  const bad = field('abc');
  root.fire('focusout', { target: bad });
  assert.equal(bad.value, 'abc', 'unreadable text is left for the plugin to flag');
});

test('Enter converts too; imperial can be a function', () => {
  let imp = false;
  const root = fakeRoot();
  wireUnitFields(root, { imperial: () => imp });
  const el = field('1/4"');
  root.fire('keydown', key(el, 'Enter'));
  assert.equal(el.value, 6.35);
  imp = true;
  const el2 = field('25.4mm');
  root.fire('keydown', key(el2, 'Enter'));
  assert.equal(el2.value, 1);
});

test('fields without data-unit are not touched', () => {
  const root = fakeRoot();
  wireUnitFields(root, { imperial: true });
  const el = field('6mm', { 'data-unit': undefined });
  delete el.getAttribute; el.getAttribute = () => null;
  root.fire('focusout', { target: el });
  assert.equal(el.value, '6mm');
});

test('arrow keys step like DevTools and stop at the minimum', () => {
  const root = fakeRoot();
  let stepped = 0;
  wireUnitFields(root, { imperial: false, onStep: () => stepped++ });
  const el = field('5', { min: '0' });
  root.fire('keydown', key(el, 'ArrowUp'));
  assert.equal(el.value, 6);
  root.fire('keydown', key(el, 'ArrowUp', { shiftKey: true }));
  assert.equal(el.value, 16);
  root.fire('keydown', key(el, 'ArrowDown', { altKey: true }));
  assert.equal(el.value, 15.9);
  root.fire('keydown', key(el, 'ArrowDown', { ctrlKey: true }));
  assert.equal(el.value, 15.899);
  el.value = '3';
  root.fire('keydown', key(el, 'ArrowDown', { shiftKey: true }));
  assert.equal(el.value, 0, 'stops at a whole minimum');
  const odd = field('0.05', { 'data-min': '0.01' });
  const e = key(odd, 'ArrowDown');
  root.fire('keydown', e);
  assert.equal(odd.value, '0.05', "doesn't move under an odd minimum");
  assert.ok(e.prevented);
  const count = field('2', { 'data-integer': '' });
  root.fire('keydown', key(count, 'ArrowUp', { altKey: true }));
  assert.equal(count.value, 3, 'whole-number fields step at least 1');
  assert.equal(stepped, 6);
});

test('arrows read typed units first; unwire removes the listeners', () => {
  const root = fakeRoot();
  const unwire = wireUnitFields(root, { imperial: true });
  const el = field('1/4"');
  root.fire('keydown', key(el, 'ArrowUp', { altKey: true }));
  assert.equal(el.value, 0.35);
  unwire();
  assert.equal(root.handlers.focusout.length + root.handlers.keydown.length, 0);
});
