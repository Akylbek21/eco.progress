import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const prerender = fs.readFileSync(new URL('../scripts/prerender.js', import.meta.url), 'utf8');
const serverEntry = fs.readFileSync(new URL('../scripts/entry-server.jsx', import.meta.url), 'utf8');
const browserEntry = fs.readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');

test('prerender delegates body rendering to the shared React server entry', () => {
  assert.match(prerender, /renderPublicApp\(entry\.path\)/);
  assert.match(prerender, /assertReactBody\(entry\.path, body\)/);
  assert.doesNotMatch(prerender, /renderSeoPage|renderServicePage|renderStaticPage/);
});

test('browser hydration and SSR share PublicApplication and PublicApp', () => {
  assert.match(browserEntry, /<PublicApplication\s*\/>/);
  assert.match(serverEntry, /<PublicApplication\s*\/>/);
  assert.match(serverEntry, /renderToReadableStream/);
  assert.match(serverEntry, /<StaticRouter location=\{url\}>/);
});
