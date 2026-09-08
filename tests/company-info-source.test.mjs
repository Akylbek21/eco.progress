import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.join(root, 'src');
const companyInfoPath = path.join(sourceRoot, 'config', 'companyInfo.ts');
const uniquePublicValues = [
  'ECOPROGRESS GROUP',
  'eco.progresss@gmail.com',
  '77781211158',
  '+7 778 121 11 58',
  '77771858088',
  '+7 777 185 80 88',
  'мкр Восток, 66',
  'Пн-Пт, 09:00-18:00',
  'Mo-Fr 09:00-18:00',
];

const sourceFiles = [];
const visit = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) visit(fullPath);
    else if (/\.(?:ts|tsx)$/u.test(entry.name) && !entry.name.includes('.generated.')) sourceFiles.push(fullPath);
  }
};
visit(sourceRoot);

test('public company identity and contact values have one source of truth', () => {
  const companyInfo = fs.readFileSync(companyInfoPath, 'utf8');
  for (const value of uniquePublicValues) assert.ok(companyInfo.includes(value), `companyInfo is missing ${value}`);

  for (const file of sourceFiles.filter((candidate) => candidate !== companyInfoPath)) {
    const content = fs.readFileSync(file, 'utf8');
    for (const value of uniquePublicValues) {
      assert.ok(!content.includes(value), `${path.relative(root, file)} duplicates public company value: ${value}`);
    }
  }
});
