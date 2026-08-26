import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const sourceRoot = fileURLToPath(new URL('../src', import.meta.url));
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.html']);
const legacyUrl = /(?:["'`]|https:\/\/ecoprogress\.kz)\/(?:services\/(?:eco-design|laboratory|permits|landfill|enterprise-support)(?=[/"'?#])|passport-othodov-kazakhstan|otchet-pek-kazakhstan|shtrafy-za-ekologiyu-kazakhstan|shtrafy-za-ekologicheskie-narusheniya-kazakhstan|news\/(?:kakie-shtrafy-za-ekologiyu-v-kazakhstane|komu-nuzhen-proizvodstvennyy-kontrol-ses|kak-poluchit-razreshenie-na-emissii|chto-takoe-pasport-othodov|kakie-dokumenty-proveryaet-ses|ekologicheskoe-soprovozhdenie-biznesa)|(?:passport-othodov|ovos-skrining-vozdeystviya|razreshenie-na-emissii|ekologicheskoe-proektirovanie|proizvodstvennyy-kontrol-ses|laboratornye-izmereniya|proekt-ndv|programma-pek|razrabotka-pek|proizvodstvennyy-ekologicheskiy-kontrol|proekt-szz|razdel-oos|programma-upravleniya-othodami|ekologicheskoe-razreshenie-na-vozdeystvie)-[^/"'\s]+)/g;

const sourceFiles = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = join(directory, entry.name);
  if (entry.isDirectory()) return sourceFiles(path);
  return sourceExtensions.has(extname(entry.name)) ? [path] : [];
});

test('frontend source and generated SEO data contain only canonical internal URLs', () => {
  const violations = sourceFiles(sourceRoot).flatMap((path) => {
    const matches = [...readFileSync(path, 'utf8').matchAll(legacyUrl)].map((match) => match[0]);
    return matches.map((url) => `${path}: ${url}`);
  });

  assert.deepEqual(violations, []);
});
