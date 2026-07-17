import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { canAccess, rolePermissions } from '../src/config/permissions.ts';

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');

test('content permissions implement the requested separation of duties', () => {
  assert.equal(canAccess('MANAGER', 'edit_content'), true);
  assert.equal(canAccess('MANAGER', 'publish_content'), false);
  assert.equal(canAccess('ECOLOGIST', 'review_content_expert'), true);
  assert.equal(canAccess('ACCOUNTANT', 'review_content_legal'), false);
  assert.equal(canAccess('ADMIN', 'review_content_legal'), true);
  assert.equal(canAccess('ADMIN', 'manage_content'), true);
  for (const permissions of Object.values(rolePermissions)) assert.equal(new Set(permissions).size, permissions.length);
});

test('CMS routes and navigation are private staff routes', async () => {
  const [app, layout] = await Promise.all([read('src/App.tsx'), read('src/layouts/StaffLayout.tsx')]);
  for (const route of ['/staff/content', '/staff/content/services', '/staff/content/articles', '/staff/content/regions', '/staff/content/audit', '/staff/content/analytics']) {
    assert.match(app, new RegExp(`path="${route.replaceAll('/', '\\/')}`));
  }
  assert.match(app, /RoleAccess roles=\{allStaffRoles\} loginPath="\/staff\/login"/);
  assert.match(layout, /permission: 'view_content'/);
});

test('administrative content client uses real API, optimistic locking and no mocks', async () => {
  const [service, editor] = await Promise.all([read('src/services/contentManagementService.ts'), read('src/pages/content/ContentManagementPages.tsx')]);
  assert.match(service, /\/admin\/content/);
  assert.match(service, /optimisticLockVersion/);
  assert.doesNotMatch(service, /mock|fallback/i);
  assert.match(editor, /statusCode === 409/);
  assert.match(editor, /window\.setTimeout[\s\S]*1000/);
  assert.match(editor, /beforeunload/);
  assert.match(editor, /canAccess\(user\?\.role, 'publish_content'\)/);
});

test('database migration contains versioning, workflow, audit and attribution constraints', async () => {
  const sql = await read('backend/src/main/resources/db/migration/V5__create_content_management.sql');
  for (const table of ['content_items', 'content_versions', 'content_status_history', 'content_comments', 'content_legal_sources', 'content_redirects', 'content_files', 'content_audit_log', 'content_experiments', 'lead_content_attribution', 'content_events']) {
    assert.match(sql, new RegExp(`CREATE TABLE ${table} \\(`));
  }
  assert.match(sql, /optimistic_lock_version BIGINT NOT NULL/);
  assert.match(sql, /CHECK \(source_path <> target_path\)/);
  assert.match(sql, /UNIQUE \(content_type, slug, locale\)/);
  assert.match(sql, /status <> 'PUBLISHED' OR published_version_id IS NOT NULL/);
});

test('public repository falls back only after API and stale cache and search uses public repository', async () => {
  const [repository, search] = await Promise.all([read('src/content/apiRepository.ts'), read('src/services/publicContentSearch.ts')]);
  const apiPosition = repository.indexOf('await fetcher');
  const cachePosition = repository.indexOf('readCache<T>(name, true)');
  const fallbackPosition = repository.indexOf('return fallback()');
  assert.ok(apiPosition >= 0 && cachePosition > apiPosition && fallbackPosition > cachePosition);
  assert.match(search, /publicContentRepository\.getServices\(\)/);
  assert.match(search, /publicContentRepository\.getArticles\(\)/);
  assert.match(search, /publicContentRepository\.getRegions\(\)/);
});

test('lead attribution is privacy-filtered, submitted and visible in CRM', async () => {
  const [analytics, form, leads] = await Promise.all([read('src/services/analytics.ts'), read('src/components/LeadForm.tsx'), read('src/pages/staff/StaffLeadsPage.tsx')]);
  assert.match(analytics, /forbiddenKey = \/\(name\|phone\|email\|iin\|bin/);
  assert.match(analytics, /firstTouchUrl/);
  assert.match(analytics, /lastTouchUrl/);
  assert.match(form, /serviceSlug/);
  assert.match(form, /formId/);
  assert.match(form, /ctaId/);
  assert.match(leads, /lead\.attribution\?\.sourceSlug/);
  assert.match(leads, /safeInternalPath/);
});

test('content migration dry-run is read-only and reports clean relations', () => {
  const result = spawnSync(process.execPath, ['scripts/content-export.mjs', '--dry-run'], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.mode, 'dry-run');
  assert.equal(report.output, null);
  assert.deepEqual(report.conflicts, []);
  assert.deepEqual(report.missingRelations, []);
  assert.ok(report.counts.services > 4);
});

test('SEO supports hreflang without publishing synthetic translations', async () => {
  const seo = await read('src/components/SEO.tsx');
  assert.match(seo, /locale: 'ru' \| 'kk' \| 'x-default'/);
  assert.match(seo, /link\.hreflang = alternate\.locale/);
  assert.doesNotMatch(seo, /translate|machineTranslation/i);
});

test('content editor exposes structured blocks, files, comments, diff and responsive preview', async () => {
  const [editor, blocks, files, comments, diff, preview, service] = await Promise.all([
    read('src/pages/content/ContentManagementPages.tsx'),
    read('src/components/content-management/ContentBlockEditor.tsx'),
    read('src/components/content-management/ContentFileUpload.tsx'),
    read('src/components/content-management/ContentCommentsPanel.tsx'),
    read('src/components/content-management/VersionDiffPanel.tsx'),
    read('src/components/content-management/ContentPreviewPanel.tsx'),
    read('src/services/contentManagementService.ts'),
  ]);
  for (const tab of ['Файлы', 'Preview', 'Проверка', 'История']) assert.match(editor, new RegExp(tab));
  assert.match(blocks, /Произвольный HTML не принимается/);
  assert.match(blocks, /Переместить блок выше/);
  assert.match(files, /allowedExtensions/);
  assert.match(files, /maxSize/);
  assert.match(comments, /fieldPath/);
  assert.match(comments, /blocking/);
  assert.match(diff, /ADDED|displayValue/);
  assert.match(preview, /desktop.*tablet.*mobile/s);
  assert.match(service, /preview-token/);
  assert.match(service, /FormData/);
});

test('public service and article pages use public content API with published fallback', async () => {
  const [services, news, servicePage, articlePage] = await Promise.all([
    read('src/services/serviceService.ts'), read('src/services/newsService.ts'),
    read('src/pages/ServiceLandingPage.tsx'), read('src/pages/NewsDetailsPage.tsx'),
  ]);
  assert.match(services, /\/public\/content\/services/);
  assert.match(news, /\/public\/content\/articles/);
  assert.match(servicePage, /publicContentRepository\.getServiceBySlug/);
  assert.match(articlePage, /publicContentRepository\.getArticleBySlug/);
  assert.doesNotMatch(services, /length > 0[\s\S]*source: 'api'/);
});
