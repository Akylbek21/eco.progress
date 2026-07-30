import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const packageJson = JSON.parse(readFileSync(resolve('package.json'), 'utf8'));
const dependencies = { ...packageJson.dependencies, ...packageJson.optionalDependencies };
if (dependencies.msw) {
  console.error('MSW must not be a production dependency.');
  process.exit(1);
}

const assets = readdirSync(resolve('dist/assets')).filter((name) => name.endsWith('.js'));
const forbidden = ['setupWorker(', 'mockServiceWorker.js', 'VITE_ENABLE_MSW'];
for (const asset of assets) {
  const source = readFileSync(resolve('dist/assets', asset), 'utf8');
  const marker = forbidden.find((item) => source.includes(item));
  if (marker) {
    console.error(`Production bundle contains forbidden mock marker "${marker}" in ${asset}.`);
    process.exit(1);
  }
}
console.log(`Production bundle security check passed (${assets.length} JS assets).`);
