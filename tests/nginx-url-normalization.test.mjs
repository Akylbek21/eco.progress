import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const hostConfig = readFileSync(new URL('../deploy/nginx-host/ecoprogress.conf', import.meta.url), 'utf8');
const containerConfig = readFileSync(new URL('../nginx.conf', import.meta.url), 'utf8');
const legacyRedirects = readFileSync(
  new URL('../deploy/nginx-host/snippets/legacy-redirects.conf', import.meta.url),
  'utf8',
);

const count = (source, fragment) => source.split(fragment).length - 1;

test('every public entry point evaluates legacy redirects before its fallback', () => {
  assert.equal(count(hostConfig, 'include /etc/nginx/snippets/legacy-redirects.conf;'), 3);
  assert.equal(count(containerConfig, 'include /etc/nginx/snippets/legacy-redirects.conf;'), 2);
});

test('legacy redirects accept trailing slashes and point directly to the canonical origin', () => {
  const rules = [...legacyRedirects.matchAll(/location ~ (\S+) \{ return 301 (\S+); \}/g)];

  assert.ok(rules.length > 0, 'expected at least one legacy redirect');
  for (const [, pattern, destination] of rules) {
    assert.ok(pattern.endsWith('/*$'), `${pattern} must accept an optional trailing slash`);
    assert.ok(
      destination.startsWith('https://ecoprogress.kz/'),
      `${destination} must use the canonical scheme and host`,
    );
    assert.ok(destination.endsWith('$is_args$args'), `${destination} must preserve the query string`);
  }

  assert.doesNotMatch(legacyRedirects, /return 301 \/[^/]/, 'relative redirects can create chains');
});

test('trailing slash redirects remove all trailing slashes in one response', () => {
  const rule = 'location ~ ^(.+[^/])/+$ {';

  assert.equal(count(hostConfig, rule), 3);
  assert.equal(count(containerConfig, rule), 2);
  assert.equal(count(hostConfig, 'return 301 https://ecoprogress.kz$1$is_args$args;'), 3);
  assert.equal(count(containerConfig, 'return 301 https://ecoprogress.kz$1$is_args$args;'), 2);
});
