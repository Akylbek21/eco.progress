import fs from 'node:fs';
import path from 'node:path';

const SITE_HOST = 'ecoprogress.kz';
const SITE_ORIGIN = `https://${SITE_HOST}`;
const keyFileName = 'b8f2e4c69a1d47f0a35e8b24c7169d5e.txt';
const root = process.cwd();

export const readIndexableUrls = () => {
  const sitemap = fs.readFileSync(path.join(root, 'public', 'sitemap.xml'), 'utf8');
  return [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/gu)].map((match) => match[1]);
};

export const validateIndexNowUrls = (urls) => {
  const unique = [...new Set(urls)];
  if (!unique.length) throw new Error('IndexNow: URL list is empty.');
  if (unique.length > 10_000) throw new Error('IndexNow: one request cannot contain more than 10,000 URLs.');
  for (const value of unique) {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== SITE_HOST) throw new Error(`IndexNow: non-canonical URL rejected: ${value}`);
  }
  return unique;
};

const key = fs.readFileSync(path.join(root, 'public', keyFileName), 'utf8').trim();
if (!/^[a-z0-9-]{8,128}$/iu.test(key)) throw new Error('IndexNow: invalid key file.');
const urls = validateIndexNowUrls(readIndexableUrls());
const payload = { host: SITE_HOST, key, keyLocation: `${SITE_ORIGIN}/${keyFileName}`, urlList: urls };

if (!process.argv.includes('--submit')) {
  console.log(`IndexNow dry run: ${urls.length} canonical URL(s), key location ${payload.keyLocation}. Use --submit after deployment.`);
} else {
  const response = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30_000),
  });
  if (![200, 202].includes(response.status)) throw new Error(`IndexNow submission failed with HTTP ${response.status}.`);
  console.log(`IndexNow accepted ${urls.length} canonical URL(s): HTTP ${response.status}.`);
}
