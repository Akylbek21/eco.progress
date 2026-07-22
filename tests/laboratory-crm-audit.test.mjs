import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('laboratory feature is separated into API, hooks, schemas, components, pages and utils', async () => {
  for (const path of [
    'src/features/laboratories/api/laboratoryService.ts', 'src/features/laboratories/api/laboratoryContracts.ts', 'src/features/laboratories/api/laboratoryMappers.ts',
    'src/features/laboratories/hooks/useLaboratories.ts', 'src/features/laboratories/hooks/useLaboratory.ts', 'src/features/laboratories/hooks/useLaboratoryEmployees.ts', 'src/features/laboratories/hooks/useLaboratoryMutations.ts',
    'src/features/laboratories/schemas/laboratorySchema.ts', 'src/features/laboratories/schemas/laboratoryEmployeeSchema.ts',
    'src/features/laboratories/components/LaboratoryForm.tsx', 'src/features/laboratories/components/LaboratoryLogoUploader.tsx',
    'src/features/laboratories/pages/LaboratoriesPage.tsx', 'src/features/laboratories/utils/laboratoryFormatters.ts',
  ]) await access(new URL(`../${path}`, import.meta.url));
});

test('list state is URL-backed, debounced, cancellable and uses client filters', async () => {
  const page = await read('src/pages/LaboratorySettingsPage.tsx');
  const service = await read('src/features/laboratories/api/laboratoryService.ts');
  const mapper = await read('src/features/laboratories/api/laboratoryMappers.ts');
  assert.match(page, /useSearchParams/);
  assert.match(page, /window\.setTimeout[\s\S]*450/);
  assert.match(service, /'\/laboratories', \{ signal \}/);
  assert.match(mapper, /query\.status === 'INACTIVE'/);
  assert.match(mapper, /rows\.slice\(page \* query\.size/);
});

test('permissions are centralized and eligible employees load only for authorized users', async () => {
  const page = await read('src/pages/LaboratorySettingsPage.tsx');
  const permissions = await read('src/utils/laboratoryPermissions.ts');
  for (const name of ['canReadLaboratories', 'canCreateLaboratory', 'canEditLaboratory', 'canDeactivateLaboratory', 'canSetDefaultLaboratory', 'canManageLaboratoryEmployees', 'canUploadLaboratoryLogo']) assert.match(permissions, new RegExp(`export const ${name}`));
  assert.match(permissions, /const READ = new Set\(\['ADMIN', 'DIRECTOR', 'HEAD', 'LABORATORY'\]\)/);
  assert.match(page, /enabled: eligibleOpen && permissions\.canManageEmployees/);
});

test('forms map DTOs, validate locally, surface field errors and resolve 409 conflicts', async () => {
  const form = await read('src/components/laboratories/LaboratoryForm.tsx');
  const schema = await read('src/features/laboratories/schemas/laboratorySchema.ts');
  assert.match(form, /useForm<LaboratoryFormValues>/);
  assert.match(form, /mapLaboratoryToForm/);
  assert.match(form, /validateLaboratoryForm/);
  assert.match(form, /setFocus\(firstInvalidField\)/);
  assert.match(form, /parsed\.status === 409/);
  assert.match(form, /Обновить данные/);
  assert.match(schema, /accreditationValidUntil < values\.accreditationIssuedAt/);
});

test('employees, default state and logo follow production safeguards', async () => {
  const page = await read('src/pages/LaboratorySettingsPage.tsx');
  const mapper = await read('src/features/laboratories/api/laboratoryMappers.ts');
  const logo = await read('src/features/laboratories/components/LaboratoryLogoUploader.tsx');
  assert.match(page, /includeInactive: employeeFilter !== 'ACTIVE'/);
  assert.match(page, /confirmAction\.laboratory\.isDefault/);
  assert.match(page, /selectedUser[\s\S]*fullName[\s\S]*email[\s\S]*phone/);
  assert.match(mapper, /safe false is used/);
  assert.match(logo, /image\/png.*image\/jpeg.*image\/webp/);
  assert.match(logo, /5 \* 1024 \* 1024/);
});

test('unsaved changes and nested interactive markup safeguards remain in place', async () => {
  const form = await read('src/components/laboratories/LaboratoryForm.tsx');
  const page = await read('src/pages/LaboratorySettingsPage.tsx');
  assert.match(form, /beforeunload/);
  assert.match(form, /Есть несохранённые изменения/);
  assert.match(page, /<button type="button" className="w-full text-left/);
  assert.match(page, /<article key=\{item\.id\}/);
});
