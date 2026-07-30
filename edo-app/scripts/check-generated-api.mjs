import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const projectRoot = resolve(import.meta.dirname, '..');
const committedDirectory = resolve(projectRoot, 'src/shared/api/generated');
const temporaryRoot = mkdtempSync(join(tmpdir(), 'ecoprogress-edo-openapi-'));
const generatedDirectory = join(temporaryRoot, 'generated');
const configPath = join(temporaryRoot, 'openapi-check.config.mjs');
const input = process.env.EDO_OPENAPI_URL || 'https://api-edo.ecoprogress.kz/openapi/edo-api.yaml';

const configSource = `
import { defineConfig } from ${JSON.stringify(pathToFileURL(resolve(projectRoot, 'node_modules/@hey-api/openapi-ts/dist/index.mjs')).href)};
export default defineConfig({
  input: ${JSON.stringify(input)},
  output: { path: ${JSON.stringify(generatedDirectory.replaceAll('\\', '/'))} },
  plugins: ['@hey-api/typescript', '@hey-api/sdk'],
});
`;

const collectFiles = (directory) => {
  const result = new Map();
  const visit = (current) => {
    for (const entry of readdirSync(current)) {
      const absolute = join(current, entry);
      if (statSync(absolute).isDirectory()) visit(absolute);
      else {
        const key = relative(directory, absolute).replaceAll('\\', '/');
        result.set(key, createHash('sha256').update(readFileSync(absolute)).digest('hex'));
      }
    }
  };
  visit(directory);
  return result;
};

try {
  writeFileSync(configPath, configSource, 'utf8');
  const executable = process.platform === 'win32' ? 'openapi-ts.cmd' : 'openapi-ts';
  const result = spawnSync(resolve(projectRoot, 'node_modules/.bin', executable), ['--file', configPath, '--no-log-file'], {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: 'inherit',
  });
  if (result.status !== 0) process.exit(result.status || 1);

  try {
    const committed = collectFiles(committedDirectory);
    const generated = collectFiles(generatedDirectory);
    const names = new Set([...committed.keys(), ...generated.keys()]);
    const differences = [...names].filter((name) => committed.get(name) !== generated.get(name));
    if (differences.length) {
      console.error('Generated OpenAPI client is stale:');
      differences.forEach((name) => console.error(` - ${name}`));
      process.exit(1);
    }
    console.log(`Generated OpenAPI client is current (${generated.size} files).`);
  } catch {
    console.error('Committed generated client is missing. Run npm run api:generate after OpenAPI becomes available.');
    process.exit(1);
  }
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
