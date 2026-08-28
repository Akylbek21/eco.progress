import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const root = process.cwd();
const syncScript = path.join(root, 'scripts', 'sync-seo-content.mjs');

const withTempProject = (run) => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'ecoprogress-seo-'));
  fs.mkdirSync(path.join(cwd, 'src', 'data'), { recursive: true });
  const snapshotPath = path.join(cwd, 'src', 'data', 'seoCmsSnapshot.generated.json');
  fs.writeFileSync(snapshotPath, '{"sentinel":true}\n', 'utf8');
  try { return run({ cwd, snapshotPath }); } finally { fs.rmSync(cwd, { recursive: true, force: true }); }
};

const fixture = {
  experts: [{
    id: 'expert-1', fullName: 'Тестовый Эксперт', position: 'Эколог',
    specializations: ['Экологическое проектирование'], experienceYears: 9,
    bio: 'Проверяет экологические материалы.', photoUrl: '/expert.jpg',
    profileUrl: '/experts/expert-1', verificationStatus: 'VERIFIED',
    verifiedAt: '2026-08-01T10:00:00Z', updatedAt: '2026-08-02T10:00:00Z',
  }, {
    id: 'hidden', verificationStatus: 'PENDING',
  }],
  cases: [{
    id: 'case-1', slug: 'real-case', title: 'Опубликованный кейс',
    description: 'Исходные данные объекта.', city: 'Шымкент', objectType: 'Предприятие',
    serviceType: 'Экологическое проектирование', task: 'Подготовить проект',
    solution: 'Провели обследование и подготовили проект.', result: 'Проект принят.',
    duration: '20 рабочих дней', completedAt: '2026-07-01T00:00:00Z',
    expertId: 'expert-1', images: [], published: true, updatedAt: '2026-08-02T10:00:00Z',
  }, { id: 'draft', published: false }],
  articleReviews: [{
    articleSlug: 'approved-article', expertId: 'expert-1', status: 'APPROVED',
    reviewedAt: '2026-08-02T10:00:00Z', updatedAt: '2026-08-02T10:00:00Z',
  }],
};

test('SEO sync writes only VERIFIED experts and published cases atomically', () => withTempProject(({ cwd, snapshotPath }) => {
  const endpoint = `data:application/json,${encodeURIComponent(JSON.stringify(fixture))}`;
  const result = spawnSync(process.execPath, [syncScript], { cwd, encoding: 'utf8', env: { ...process.env, SEO_CONTENT_API_URL: endpoint } });
  assert.equal(result.status, 0, result.stderr);
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  assert.equal(snapshot.experts.length, 1);
  assert.equal(snapshot.experts[0].verificationStatus, 'VERIFIED');
  assert.equal(snapshot.cases.length, 1);
  assert.equal(snapshot.cases[0].published, true);
  assert.equal(snapshot.articleReviews[0].status, 'APPROVED');
  assert.ok(snapshot.generatedAt);
  assert.equal(snapshot.source, endpoint);
}));

test('SEO sync failure never overwrites the previous snapshot', () => withTempProject(({ cwd, snapshotPath }) => {
  const before = fs.readFileSync(snapshotPath, 'utf8');
  const endpoint = `data:application/json,${encodeURIComponent(JSON.stringify({ experts: [], cases: [], articleReviews: [] }))}`;
  const result = spawnSync(process.execPath, [syncScript], { cwd, encoding: 'utf8', env: { ...process.env, SEO_CONTENT_API_URL: endpoint } });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /all empty/);
  assert.equal(fs.readFileSync(snapshotPath, 'utf8'), before);
}));

test('unavailable CMS configuration fails closed and preserves the snapshot', () => withTempProject(({ cwd, snapshotPath }) => {
  const before = fs.readFileSync(snapshotPath, 'utf8');
  const env = { ...process.env };
  delete env.SEO_CONTENT_API_URL;
  delete env.SEO_CONTENT_API_TOKEN;
  const result = spawnSync(process.execPath, [syncScript], { cwd, encoding: 'utf8', env });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /SEO_CONTENT_API_URL is required/);
  assert.equal(fs.readFileSync(snapshotPath, 'utf8'), before);
}));

test('production build is gated by CMS sync before sitemap and prerender', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.match(pkg.scripts.build, /^npm run seo:content:sync/);
  assert.ok(pkg.scripts.build.indexOf('seo:content:sync') < pkg.scripts.build.indexOf('generate:sitemap'));
  assert.ok(pkg.scripts.build.indexOf('generate:sitemap') < pkg.scripts.build.indexOf('prerender'));
  assert.ok(pkg.scripts.build.indexOf('prerender') < pkg.scripts.build.indexOf('seo:audit'));
});

test('prerender-facing pages seed React Query from the generated snapshot', () => {
  for (const file of ['src/pages/CasesPage.tsx', 'src/pages/CaseDetailsPage.tsx', 'src/components/content/AeoContent.tsx']) {
    assert.match(fs.readFileSync(path.join(root, file), 'utf8'), /initialData:/, file);
  }
  assert.match(fs.readFileSync(path.join(root, 'src/pages/NewsPage.tsx'), 'utf8'), /initialData: prerenderNewsResult/);
});
