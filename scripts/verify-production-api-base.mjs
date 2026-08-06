import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const assetsDirectory = path.resolve('dist', 'assets');
const files = await readdir(assetsDirectory);
const javascriptFiles = files.filter((file) => file.endsWith('.js'));
const insecureApiPattern = /http:\/\/[^"'`\s]+\/api[\/"'`]/i;

for (const file of javascriptFiles) {
  const source = await readFile(path.join(assetsDirectory, file), 'utf8');
  const match = source.match(insecureApiPattern);
  if (match) {
    throw new Error(`Production bundle contains an insecure API base URL in ${file}: ${match[0]}`);
  }
}

console.log(`Production API base check passed (${javascriptFiles.length} JavaScript assets inspected).`);
