import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ModuleKind, ScriptTarget, transpileModule } from 'typescript';
import test from 'node:test';

const transpile = async (path, dependencies = {}) => {
  const source = (await readFile(new URL(`../${path}`, import.meta.url), 'utf8')).replaceAll('import.meta.env.DEV', 'false');
  const code = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  const require = (specifier) => {
    if (specifier in dependencies) return dependencies[specifier];
    throw new Error(`Unexpected test dependency: ${specifier}`);
  };
  Function('require', 'module', 'exports', code)(require, module, module.exports);
  return module.exports;
};

let modulesPromise;
const loadModules = async () => {
  if (!modulesPromise) modulesPromise = (async () => {
    const types = await transpile('src/types/laboratories.ts');
    const formatters = await transpile('src/features/laboratories/utils/laboratoryFormatters.ts', { '../../../types/laboratories': types });
    const mappers = await transpile('src/features/laboratories/api/laboratoryMappers.ts', { '../../../types/laboratories': types, '../utils/laboratoryFormatters': formatters });
    const schema = await transpile('src/features/laboratories/schemas/laboratorySchema.ts', { '../../../types/laboratories': types });
    const permissions = await transpile('src/utils/laboratoryPermissions.ts', { '../types/laboratories': types });
    return { ...formatters, ...mappers, ...schema, ...permissions };
  })();
  return modulesPromise;
};

const form = {
  version: 3, name: '  Лаборатория  ', shortName: '', legalName: '', bin: '', address: '  Адрес  ', city: '', phone: '', email: '', website: '',
  accreditationNumber: '', accreditationIssuedAt: '', accreditationValidUntil: '', accreditationIssuedBy: '', directorId: null, laboratoryHeadId: null,
  standardNote: '', logoUrl: '', isDefault: false, active: true,
};

test('accreditation status uses the required 90-day boundary', async () => {
  const { getAccreditationStatus } = await loadModules();
  const originalNow = Date.now;
  Date.now = () => new Date('2026-01-01T00:00:00Z').getTime();
  try {
    assert.equal(getAccreditationStatus(null), 'NOT_SPECIFIED');
    assert.equal(getAccreditationStatus('2025-12-31'), 'EXPIRED');
    assert.equal(getAccreditationStatus('2026-03-31'), 'EXPIRING');
    assert.equal(getAccreditationStatus('2026-04-02'), 'VALID');
  } finally { Date.now = originalNow; }
});

test('laboratory mappers separate DTO, UI form and write contracts', async () => {
  const { mapLaboratoryDtoToModel, mapLaboratoryToForm, mapLaboratoryFormToCreateRequest, mapLaboratoryFormToUpdateRequest } = await loadModules();
  const model = mapLaboratoryDtoToModel({ data: { id: 7, version: 3, name: 'Лаборатория', address: 'Адрес', isDefault: true, active: true } });
  assert.deepEqual(mapLaboratoryToForm(model), { ...form, id: 7, name: 'Лаборатория', address: 'Адрес', isDefault: true });
  assert.deepEqual(mapLaboratoryFormToCreateRequest(form), { name: 'Лаборатория', shortName: null, legalName: null, bin: null, address: 'Адрес', city: null, phone: null, email: null, website: null, accreditationNumber: null, accreditationIssuedAt: null, accreditationValidUntil: null, accreditationIssuedBy: null, directorId: null, laboratoryHeadId: null, standardNote: null, logoUrl: null, isDefault: false, active: true });
  assert.equal(mapLaboratoryFormToUpdateRequest(form).version, 3);
});

test('list mapper filters, sorts and paginates backend arrays on the client', async () => {
  const { mapLaboratoriesResponse } = await loadModules();
  const response = [{ id: 1, name: 'Бета', address: 'A', active: false }, { id: 2, name: 'Альфа', address: 'B', active: true }, { id: 3, name: 'Гамма', address: 'C', active: true }];
  const page = mapLaboratoriesResponse(response, { page: 0, size: 1, status: 'ACTIVE', sort: 'name,asc' });
  assert.equal(page.totalElements, 2);
  assert.equal(page.content.length, 1);
  assert.equal(page.content[0].name, 'Альфа');
  assert.equal(page.hasNext, true);
});

test('validation rejects required fields, BIN, email and invalid accreditation period', async () => {
  const { validateLaboratoryForm } = await loadModules();
  const errors = validateLaboratoryForm({ ...form, name: '', address: '', bin: '123', email: 'bad', accreditationNumber: 'KZ', accreditationIssuedAt: '2027-01-01', accreditationValidUntil: '2026-01-01' });
  for (const field of ['name', 'address', 'bin', 'email', 'accreditationValidUntil']) assert.ok(errors[field]);
});

test('permission matrix separates read, edit and owner operations', async () => {
  const permissions = await loadModules();
  const laboratory = { id: 1, name: 'Л', address: 'А', active: true, isDefault: false };
  assert.equal(permissions.canReadLaboratories('LABORATORY'), true);
  assert.equal(permissions.canEditLaboratory('LABORATORY', laboratory), false);
  assert.equal(permissions.canEditLaboratory('HEAD', laboratory), true);
  assert.equal(permissions.canSetDefaultLaboratory('HEAD'), false);
  assert.equal(permissions.canSetDefaultLaboratory('ADMIN'), true);
  assert.equal(permissions.canManageLaboratoryEmployees('HEAD', { ...laboratory, active: false }), false);
});
