import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const dist = path.join(root, 'dist');
const componentPath = path.join(root, 'src', 'components', 'ui', 'ResponsiveImage.tsx');
const requiredRoutes = [
  '/',
  '/ecologicheskie-uslugi-shymkent',
  '/services/program-pek',
  '/services/report-pek',
  '/regions',
  '/news',
  '/about',
  '/cases',
];

const pageFile = (route) => route === '/'
  ? path.join(dist, 'index.html')
  : path.join(dist, route.slice(1), 'index.html');
const tags = (html, name) => [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'gi'))].map((match) => match[0]);
const attribute = (tag, name) => tag.match(new RegExp(`\\s${name}=["']([^"']*)["']`, 'i'))?.[1];
const localCandidates = (value = '') => value.split(',').map((candidate) => candidate.trim().split(/\s+/)[0]).filter((url) => url.startsWith('/'));

test('ResponsiveImage visibility is independent from load events and skeleton state', () => {
  const source = fs.readFileSync(componentPath, 'utf8');
  assert.doesNotMatch(source, /useState\(false\).*loaded|setLoaded|onLoad=/s);
  assert.doesNotMatch(source, /opacity-0|route-skeleton/);
  assert.match(source, /onError=\{\(\) => setFailed\(true\)\}/);
});

test('required public routes prerender visible responsive images before hydration', () => {
  for (const route of requiredRoutes) {
    const file = pageFile(route);
    assert.equal(fs.existsSync(file), true, `${route}: prerender HTML is missing`);
    const html = fs.readFileSync(file, 'utf8');
    const images = tags(html, 'img');
    assert.ok(images.length > 0, `${route}: prerender HTML contains no img`);
    assert.ok(tags(html, 'picture').length > 0, `${route}: prerender HTML contains no picture`);
    assert.ok(images.every((img) => !/\bopacity-0\b/.test(attribute(img, 'class') || '')), `${route}: an img is hidden before hydration`);
    assert.ok(images.some((img) => attribute(img, 'loading') === 'eager' && attribute(img, 'fetchpriority') === 'high'), `${route}: priority hero is not eager/high`);
    assert.ok(images.some((img) => attribute(img, 'loading') === 'lazy'), `${route}: lazy images were not preserved`);
  }
});

test('every local prerender image candidate exists in the production output', () => {
  const htmlFiles = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const resolved = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(resolved);
      else if (entry.name.endsWith('.html')) htmlFiles.push(resolved);
    }
  };
  visit(dist);

  const missing = [];
  for (const file of htmlFiles) {
    const html = fs.readFileSync(file, 'utf8');
    for (const tag of [...tags(html, 'img'), ...tags(html, 'source')]) {
      const candidates = [attribute(tag, 'src'), ...localCandidates(attribute(tag, 'srcset'))].filter(Boolean);
      for (const candidate of candidates) {
        const pathname = decodeURIComponent(new URL(candidate, 'https://ecoprogress.kz').pathname).replace(/^\/+/, '');
        if (!fs.existsSync(path.join(dist, pathname))) missing.push(`${path.relative(dist, file)} -> ${candidate}`);
      }
    }
  }
  assert.deepEqual(missing, [], `prerender image URLs would return 404:\n${missing.join('\n')}`);
});

test('generated responsive manifest contains only files that exist in public/media', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'src', 'data', 'responsiveImages.generated.json'), 'utf8'));
  for (const [name, variants] of Object.entries(manifest)) {
    for (const extension of ['avif', 'webp', 'jpg']) {
      for (const width of variants[extension]) {
        assert.equal(fs.existsSync(path.join(root, 'public', 'media', `${name}-${width}.${extension}`)), true);
      }
    }
  }
  for (const directory of ['web-images-1600x900', 'web-images-batch2-1600x900']) {
    assert.ok(fs.readdirSync(path.join(root, 'public', directory)).some((file) => file.endsWith('.webp')), `${directory} has no images`);
  }
});
