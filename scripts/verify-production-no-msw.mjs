import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const assetsDirectory = path.resolve('dist', 'assets');
const files = await readdir(assetsDirectory);
const javascriptFiles = files.filter((file) => file.endsWith('.js'));
const forbiddenRuntimeMarkers = [
  'setupWorker',
  'mockServiceWorker',
  'MSW_TEST_CMS',
  'VITE_PEK_MSW_SCENARIO',
];

for (const file of javascriptFiles) {
  const source = await readFile(path.join(assetsDirectory, file), 'utf8');
  const marker = forbiddenRuntimeMarkers.find((value) => source.includes(value));
  if (marker) {
    throw new Error(`Production bundle contains PEK MSW runtime marker "${marker}" in ${file}`);
  }
}

console.log(`Production MSW check passed (${javascriptFiles.length} JavaScript assets inspected).`);
