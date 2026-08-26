import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('public auth links reload the document into the private runtime', async () => {
  const [layout, main] = await Promise.all([
    readFile(new URL('../src/layouts/PublicLayout.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/main.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(main, /privatePrefixes\s*=\s*\[[^\]]*'\/login'[^\]]*'\/register'[^\]]*'\/reset-password'/s);
  assert.match(main, /!isPrivateRuntime\s*&&\s*root\.dataset\.prerendered/);
  assert.match(main, /isPrivateRuntime\s*&&\s*root\.hasChildNodes\(\)[\s\S]*root\.replaceChildren\(\)/);
  assert.match(layout, /opensPrivateRuntime\(item\.path\)/);
  assert.match(layout, /opensPrivateRuntime\(path\)/);
  assert.match(layout, /<a href="\/login"/);
  assert.match(layout, /<a href="\/staff\/login"/);
  assert.doesNotMatch(layout, /<(?:Link|NavLink)\b[^>]*(?:to="\/login"|to="\/staff\/login")/s);
});
