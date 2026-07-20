import { transformSync } from 'esbuild';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export async function load(url, context, nextLoad) {
  if (url.endsWith('.ts')) {
    const filePath = fileURLToPath(url);
    const source = readFileSync(filePath, 'utf8');
    const { code } = transformSync(source, {
      loader: 'ts',
      format: 'esm',
      target: 'esnext',
      sourcefile: filePath,
    });
    return { format: 'module', source: code, shortCircuit: true };
  }
  return nextLoad(url, context);
}
