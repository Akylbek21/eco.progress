import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';

const sourceRoot = fileURLToPath(new URL('../src/', import.meta.url));

const collectSourceFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(entryPath);
    return entry.isFile() && /\.tsx?$/.test(entry.name) ? [entryPath] : [];
  }));
  return nested.flat();
};

const tagName = (tag) => tag.getText();
const hasAttribute = (opening, name) => opening.attributes.properties.some(
  (attribute) => ts.isJsxAttribute(attribute) && attribute.name.text === name,
);
const isInteractive = (opening) => {
  const name = tagName(opening.tagName);
  if (name === 'Button' && hasAttribute(opening, 'asChild')) return false;
  return ['button', 'Button', 'a', 'Link', 'NavLink'].includes(name);
};

test('JSX does not nest buttons or links inside other interactive elements', async () => {
  const files = (await collectSourceFiles(sourceRoot)).filter((file) => file.endsWith('.tsx'));
  const violations = [];

  for (const file of files) {
    const source = await readFile(file, 'utf8');
    const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const visit = (node, interactiveAncestors = []) => {
      const opening = ts.isJsxElement(node)
        ? node.openingElement
        : ts.isJsxSelfClosingElement(node)
          ? node
          : null;
      const interactive = opening ? isInteractive(opening) : false;
      if (interactive && interactiveAncestors.length) {
        const position = sourceFile.getLineAndCharacterOfPosition(opening.getStart(sourceFile));
        violations.push(`${path.relative(sourceRoot, file)}:${position.line + 1} ${tagName(opening.tagName)} inside ${interactiveAncestors.at(-1)}`);
      }
      const nextAncestors = interactive && opening
        ? [...interactiveAncestors, tagName(opening.tagName)]
        : interactiveAncestors;
      node.forEachChild((child) => visit(child, nextAncestors));
    };
    visit(sourceFile);
  }

  assert.deepEqual(violations, []);
});

test('TypeScript sources contain no explicit any or suppression directives', async () => {
  const files = await collectSourceFiles(sourceRoot);
  const violations = [];
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    const scriptKind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, scriptKind);
    const visit = (node) => {
      if (node.kind === ts.SyntaxKind.AnyKeyword) {
        const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        violations.push(`${path.relative(sourceRoot, file)}:${position.line + 1} explicit any`);
      }
      node.forEachChild(visit);
    };
    visit(sourceFile);
    if (/\/\/\s*@ts-(?:ignore|nocheck)/.test(source)) {
      violations.push(`${path.relative(sourceRoot, file)} suppression directive`);
    }
  }
  assert.deepEqual(violations, []);
});
