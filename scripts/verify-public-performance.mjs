import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const distDir = path.join(root, 'dist');
const html = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');
const initialAssets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"?]+\.(?:js|css))"/g)].map((match) => match[1]);

if (initialAssets.length === 0) throw new Error('Public bundle check: no initial assets found in dist/index.html.');

const initialSource = initialAssets
  .map((asset) => fs.readFileSync(path.join(distDir, asset.replace(/^\//, '')), 'utf8'))
  .join('\n');

const forbiddenPreloadMarkers = ['App-', 'AuthContext-', 'http-', 'query-', 'QueryRuntime-', 'ProtocolsPage-', 'ProtocolEditorPage-', 'StaffPages-'];
for (const marker of forbiddenPreloadMarkers) {
  if (initialAssets.some((asset) => asset.includes(marker))) {
    throw new Error(`Public bundle check: CRM-only asset was preloaded (${marker}).`);
  }
}

const forbiddenInitialMarkers = [
  'seoRegistry.generated',
  '/pexels-jan-van.jpg',
  '/pexels-enginakyurt.jpg',
  '/cottonbro.jpg',
  '/edward.jpg',
  '/jose.jpg',
];

for (const marker of forbiddenInitialMarkers) {
  if (html.includes(marker) || initialSource.includes(marker)) {
    throw new Error(`Public bundle check: forbidden initial marker ${marker}.`);
  }
}

const seoComponent = fs.readFileSync(path.join(root, 'src', 'components', 'SEO.tsx'), 'utf8');
if (seoComponent.includes('seoRegistry.generated')) {
  throw new Error('Public bundle check: SEO.tsx imports the build-only SEO registry.');
}

console.log(`Public performance check passed (${initialAssets.length} initial JS/CSS assets inspected).`);
