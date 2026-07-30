import { readdirSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

const assetsDirectory = resolve('dist/assets');
const budgets = {
  initialJs: 280_000,
  largestJs: 450_000,
  totalJs: 1_200_000,
  totalCss: 100_000,
};

const files = readdirSync(assetsDirectory).map((name) => ({
  name,
  bytes: statSync(join(assetsDirectory, name)).size,
}));
const javascript = files.filter((file) => file.name.endsWith('.js'));
const css = files.filter((file) => file.name.endsWith('.css'));
const initial = javascript.find((file) => /^index-[\w-]+\.js$/.test(file.name));
const largest = javascript.reduce((current, file) => file.bytes > current.bytes ? file : current, { name: 'none', bytes: 0 });
const totalJs = javascript.reduce((sum, file) => sum + file.bytes, 0);
const totalCss = css.reduce((sum, file) => sum + file.bytes, 0);

const report = {
  initialJs: initial?.bytes || 0,
  largestJs: largest.bytes,
  largestChunk: basename(largest.name),
  totalJs,
  totalCss,
};
console.log(JSON.stringify({ budgets, report }, null, 2));

const exceeded = [
  report.initialJs > budgets.initialJs && `initial JS ${report.initialJs} > ${budgets.initialJs}`,
  report.largestJs > budgets.largestJs && `largest JS ${report.largestJs} > ${budgets.largestJs}`,
  report.totalJs > budgets.totalJs && `total JS ${report.totalJs} > ${budgets.totalJs}`,
  report.totalCss > budgets.totalCss && `CSS ${report.totalCss} > ${budgets.totalCss}`,
].filter(Boolean);

if (exceeded.length) {
  console.error(`Bundle budget exceeded:\n${exceeded.map((item) => ` - ${item}`).join('\n')}`);
  process.exit(1);
}
