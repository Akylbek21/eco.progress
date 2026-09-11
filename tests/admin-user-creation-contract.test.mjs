import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('admin user creation follows the backend pending-setup contract', async () => {
  const [page, service] = await Promise.all([
    read('src/pages/AdminUsersPage.tsx'),
    read('src/services/adminUserService.ts'),
  ]);

  assert.doesNotMatch(page, /!editingStaff && !staffForm\.password/);
  assert.match(page, /if \(editingStaff && staffForm\.password\.trim\(\)\) payload\.password/);
  assert.doesNotMatch(page, /value: 'LAB_HEAD'/);
  assert.match(page, /ссылку для самостоятельной установки пароля/);
  assert.match(page, /catch \{\s*\/\/ The mutation displays the normalized API error/);
  assert.match(service, /'pending_setup'/);
});
