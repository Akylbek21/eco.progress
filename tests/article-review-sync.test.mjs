import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const script = path.join(process.cwd(), 'scripts', 'sync-seo-content.mjs');

const inTempProject = (run) => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'ecoprogress-reviews-'));
  fs.mkdirSync(path.join(cwd, 'src', 'data'), { recursive: true });
  const snapshot = path.join(cwd, 'src', 'data', 'articleReviews.generated.json');
  const caseSnapshot = path.join(cwd, 'src', 'data', 'caseStudies.generated.json');
  fs.writeFileSync(snapshot, '{"schemaVersion":1,"articleReviews":[]}\n', 'utf8');
  fs.writeFileSync(caseSnapshot, '{"schemaVersion":1,"cases":[]}\n', 'utf8');
  try { run({ cwd, snapshot, caseSnapshot }); } finally { fs.rmSync(cwd, { recursive: true, force: true }); }
};

test('CMS review sync persists a complete APPROVED decision', () => inTempProject(({ cwd, snapshot }) => {
  const articleReviews = [{
    articleSlug: 'program-pek', expertId: 'verified-expert', status: 'APPROVED',
    reviewedAt: '2026-08-31T10:00:00Z', updatedAt: '2026-08-31T10:00:00Z',
  }];
  const endpoint = `data:application/json,${encodeURIComponent(JSON.stringify({ articleReviews, cases: [] }))}`;
  const result = spawnSync(process.execPath, [script], { cwd, encoding: 'utf8', env: { ...process.env, SEO_CONTENT_API_URL: endpoint } });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(fs.readFileSync(snapshot, 'utf8')).articleReviews, articleReviews);
}));

test('CMS review sync rejects incomplete approval without overwriting the snapshot', () => inTempProject(({ cwd, snapshot }) => {
  const before = fs.readFileSync(snapshot, 'utf8');
  const endpoint = `data:application/json,${encodeURIComponent(JSON.stringify({ cases: [], articleReviews: [{
    articleSlug: 'program-pek', status: 'APPROVED', updatedAt: '2026-08-31T10:00:00Z',
  }] }))}`;
  const result = spawnSync(process.execPath, [script], { cwd, encoding: 'utf8', env: { ...process.env, SEO_CONTENT_API_URL: endpoint } });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /invalid CMS record/);
  assert.equal(fs.readFileSync(snapshot, 'utf8'), before);
}));

test('CMS sync persists complete approved published cases', () => inTempProject(({ cwd, caseSnapshot }) => {
  const cases = [{
    id: 'case-pek-1', slug: 'pek-shymkent', title: 'ПЭК для производственного предприятия',
    description: 'Исходные документы предприятия', city: 'Шымкент', region: 'Туркестанская область', industry: 'Производство',
    objectType: 'Производственное предприятие', objectCategory: 'II категория',
    serviceType: 'program-pek', task: 'Актуализировать программу ПЭК', solution: 'Проверили документы и подготовили программу',
    workPerformed: ['Проверили документы', 'Подготовили программу'], regulations: [{ title: 'Экологический кодекс Республики Казахстан' }],
    metrics: [{ label: 'Источники', value: '17' }, { label: 'Точки мониторинга', value: '8' }],
    result: 'Программа передана заказчику', duration: '15 рабочих дней',
    completedAt: '2026-07-10', expertId: 'expert-1', reviewerId: 'expert-2', reviewStatus: 'APPROVED',
    reviewedAt: '2026-08-20', images: [], clientAnonymous: true, published: true,
    publishedAt: '2026-08-21', updatedAt: '2026-08-21',
  }];
  const endpoint = `data:application/json,${encodeURIComponent(JSON.stringify({ articleReviews: [], cases }))}`;
  const result = spawnSync(process.execPath, [script], { cwd, encoding: 'utf8', env: { ...process.env, SEO_CONTENT_API_URL: endpoint } });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(fs.readFileSync(caseSnapshot, 'utf8')).cases, cases);
}));

test('CMS sync rejects an unreviewed published case without overwriting the snapshot', () => inTempProject(({ cwd, caseSnapshot }) => {
  const before = fs.readFileSync(caseSnapshot, 'utf8');
  const cases = [{ id: 'case-1', slug: 'case-1', published: true, reviewStatus: 'DRAFT' }];
  const endpoint = `data:application/json,${encodeURIComponent(JSON.stringify({ articleReviews: [], cases }))}`;
  const result = spawnSync(process.execPath, [script], { cwd, encoding: 'utf8', env: { ...process.env, SEO_CONTENT_API_URL: endpoint } });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /invalid published CMS record/);
  assert.equal(fs.readFileSync(caseSnapshot, 'utf8'), before);
}));
