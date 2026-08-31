import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { experts } from '../src/content/experts/experts.ts';
import { caseStudies } from '../src/content/cases/caseStudies.ts';
import { articleContent } from '../src/content/articles/articleContent.ts';
import { isArticleApproved } from '../src/content/articleReview.ts';

const root = process.cwd();

test('frontend expert registry contains only published VERIFIED profiles with confirmed credentials', () => {
  assert.equal(experts.length, 8);
  assert.equal(new Set(experts.map((item) => item.slug)).size, experts.length);
  assert.equal(experts.reduce((sum, item) => sum + item.credentials.length, 0), 9);
  for (const expert of experts) {
    assert.equal(expert.published, true);
    assert.equal(expert.verificationStatus, 'VERIFIED');
    assert.ok(expert.fullName && expert.profileUrl === `/experts/${expert.slug}`);
    assert.ok(expert.credentials.every((item) => item.title && item.document && item.issuedBy && item.date));
    assert.equal(expert.position, undefined);
    assert.equal(expert.experienceYears, undefined);
    assert.equal(expert.photo, undefined);
  }
});

test('all 14 articles remain visible but require specialist review', () => {
  assert.equal(articleContent.length, 14);
  assert.ok(articleContent.every((item) => item.status === 'published'));
  assert.ok(articleContent.every((item) => item.reviewStatus === 'requires-specialist-review'));
  assert.ok(articleContent.every((item) => !isArticleApproved(item)));
});

test('case architecture uses a fail-closed build snapshot and publishes no unconfirmed examples', () => {
  assert.deepEqual(caseStudies, []);
  const source = fs.readFileSync(path.join(root, 'src/content/cases/caseStudies.ts'), 'utf8');
  assert.match(source, /caseStudies\.generated\.json/);
  assert.match(source, /normalizePublicCase/);
  assert.doesNotMatch(source, /fetch|\/public\/content\/cases/i);
});

test('production build syncs CMS review decisions before sitemap and prerender', () => {
  const scripts = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).scripts;
  assert.match(scripts.build, /^npm run seo:content:sync/);
  assert.ok(scripts.build.indexOf('seo:content:sync') < scripts.build.indexOf('generate:sitemap'));
  assert.ok(scripts.build.indexOf('generate:sitemap') < scripts.build.indexOf('prerender'));
  assert.ok(scripts.build.indexOf('prerender') < scripts.build.indexOf('seo:audit'));
});

test('employees and experts pages render from the same static registry without loading-only SSR', () => {
  const page = fs.readFileSync(path.join(root, 'src/pages/EmployeesPage.tsx'), 'utf8');
  const details = fs.readFileSync(path.join(root, 'src/pages/ExpertDetailsPage.tsx'), 'utf8');
  assert.match(page, /experts\.map/);
  assert.match(page, /expert\.credentials\.map/);
  assert.doesNotMatch(page, /isLoading|Загрузка/);
  assert.match(details, /expert\.credentials\.map/);
  assert.match(details, /Проверенные статьи/);
  assert.match(details, /Опубликованные кейсы/);
});
