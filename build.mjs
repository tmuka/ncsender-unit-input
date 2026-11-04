// Makes dist/ from src/unit-input.js: a CommonJS copy for Node and a
// script for pasting into (or loading from) a plugin's config.html, which
// sets window.NcUnitInput. No dependencies.
import fs from 'node:fs';

const src = fs.readFileSync(new URL('./src/unit-input.js', import.meta.url), 'utf8');
const names = [...src.matchAll(/^export (?:function|var) (\w+)/gm)].map((m) => m[1]);
const body = src.replace(/^export /gm, '');
const head = '// Generated from src/unit-input.js by build.mjs: edit that, then npm run build.\n';
const list = names.map((n) => `${n}: ${n}`).join(', ');
const out = {
  'dist/unit-input.cjs': `${head}'use strict';\n${body}\nmodule.exports = { ${list} };\n`,
  'dist/unit-input.global.js': `${head}var NcUnitInput = (function () {\n${body}\nreturn { ${list} };\n})();\nif (typeof window !== 'undefined') window.NcUnitInput = NcUnitInput;\n`,
};
if (process.argv.includes('--check')) {
  const stale = Object.keys(out).filter((f) => !fs.existsSync(f) || fs.readFileSync(f, 'utf8') !== out[f]);
  if (stale.length) { console.error(`out of date: ${stale.join(', ')} (npm run build)`); process.exit(1); }
} else {
  for (const [f, text] of Object.entries(out)) fs.writeFileSync(f, text);
  console.log(`built ${Object.keys(out).join(', ')}: ${names.join(', ')}`);
}
