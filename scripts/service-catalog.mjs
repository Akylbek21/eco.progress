import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(process.cwd(), 'src', 'content', 'serviceCatalog.ts'), 'utf8');

export const frontendServices = [...source.matchAll(/item\(\{\s*slug:\s*'([^']+)',\s*title:\s*'([^']+)'[\s\S]*?category:\s*'([^']+)',\s*shortDescription:\s*'([^']+)'/g)]
  .map(([, slug, title, category, description]) => ({ slug, title, category, description }));

if (frontendServices.length === 0) throw new Error('Unable to read the frontend service catalog.');
