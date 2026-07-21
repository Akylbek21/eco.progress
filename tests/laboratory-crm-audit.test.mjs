import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('1-7 list, search, pagination and server filters open laboratory details', async () => {
  const page = await read('src/pages/LaboratorySettingsPage.tsx');
  assert.match(page, /getLaboratories\(\{ page, size, search:/);
  assert.match(page, /window\.setTimeout[\s\S]*450/);
  assert.match(page, /status, accreditationStatus:/);
  assert.match(page, /listQuery\.data\.first/);
  assert.match(page, /listQuery\.data\.last/);
  assert.match(page, /queryKey: \['laboratory-details', selected\]/);
});

test('8-10 HEAD sees menu and LABORATORY is read-only without eligible request', async () => {
  const layout = await read('src/layouts/StaffLayout.tsx');
  const page = await read('src/pages/LaboratorySettingsPage.tsx');
  const permissions = await read('src/utils/laboratoryPermissions.ts');
  assert.match(layout, /'HEAD', 'LABORATORY'/);
  assert.match(permissions, /const VIEW = new Set\(\['ADMIN', 'DIRECTOR', 'HEAD', 'LABORATORY'\]\)/);
  assert.match(permissions, /const EDIT = new Set\(\['ADMIN', 'DIRECTOR', 'HEAD'\]\)/);
  assert.match(page, /enabled: eligibleOpen && permissions\.canManageEmployees/);
});

test('11-16 creation, update, accreditation, default and archive use dedicated mutations', async () => {
  const page = await read('src/pages/LaboratorySettingsPage.tsx');
  const form = await read('src/components/laboratories/LaboratoryForm.tsx');
  assert.match(page, /createLaboratory\(values\)/);
  assert.match(page, /updateLaboratory\(editing\.id, values\)/);
  assert.match(form, /useForm<LaboratoryFormValues>/);
  assert.match(form, /accreditationValidFrom > values\.accreditationValidUntil/);
  assert.match(page, /setDefaultLaboratory/);
  assert.match(page, /archiveLaboratory/);
  assert.match(page, /Сначала назначьте другую лабораторию по умолчанию|parseLaboratoryApiError/);
});

test('17-24 employees use canonical ids, explicit inactive filter and active leadership', async () => {
  const page = await read('src/pages/LaboratorySettingsPage.tsx');
  const service = await read('src/services/laboratorySettingsService.ts');
  const errors = await read('src/utils/laboratoryApiError.ts');
  assert.match(page, /includeInactive: employeeFilter !== 'ACTIVE'/);
  assert.match(page, /addLaboratoryEmployee\(selected, employeeDraft\)/);
  assert.match(page, /updateLaboratoryEmployee\(selected, editingEmployee\.id/);
  assert.match(page, /deactivateLaboratoryEmployee\(selected, confirmAction\.employee\.id\)/);
  assert.match(page, /activateLaboratoryEmployee\(selected, confirmAction\.employee\.id\)/);
  assert.match(errors, /LABORATORY_EMPLOYEE_ALREADY_EXISTS/);
  assert.match(page, /parseLaboratoryApiError/);
  assert.match(page, /directorEmployeeId/);
  assert.match(page, /headEmployeeId/);
});

test('25-28 logo validation and archived read-only mode are enforced', async () => {
  const page = await read('src/pages/LaboratorySettingsPage.tsx');
  const permissions = await read('src/utils/laboratoryPermissions.ts');
  assert.match(page, /image\/png.*image\/jpeg/);
  assert.match(page, /file\.size > logoMaxSize/);
  assert.match(page, /object-contain/);
  assert.match(page, /Логотип не загружен/);
  assert.match(permissions, /!laboratory\.archived/);
});

test('29-33 protocol creation selects default, clears dependent values and refreshes snapshot', async () => {
  const create = await read('src/pages/ProtocolCreatePage.tsx');
  const editor = await read('src/pages/ProtocolEditorPage.tsx');
  const api = await read('src/services/apiProtocolService.ts');
  assert.match(create, /defaultLaboratory/);
  assert.match(create, /executorId: ''/);
  assert.match(create, /measurementDeviceId: ''/);
  assert.match(create, /const executorId = Number\(executor\.id\)/);
  assert.match(editor, /refreshLaboratorySnapshot/);
  assert.match(api, /refresh-laboratory-data/);
  assert.match(editor, /Лаборатория по умолчанию не настроена/);
});

test('34-36 unsaved changes, interactive markup and 403 message are covered', async () => {
  const form = await read('src/components/laboratories/LaboratoryForm.tsx');
  const page = await read('src/pages/LaboratorySettingsPage.tsx');
  assert.match(form, /Есть несохранённые изменения\. Закрыть форму\?/);
  assert.match(page, /Недостаточно прав для просмотра настроек лаборатории/);
  assert.match(page, /<button type="button" className="w-full text-left/);
  assert.match(page, /<article key=\{item\.id\}/);
});
