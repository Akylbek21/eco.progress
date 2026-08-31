import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

const read = (file) => fs.readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('protocol creation uses the backend creation-context and from-pek contracts', async () => {
  const api = await read('src/services/apiProtocolService.ts');
  assert.match(api, /getProtocolCreationContext[\s\S]*['"]\/protocols\/creation-context['"]/);
  assert.match(api, /createProtocolFromPek[\s\S]*['"]\/protocols\/from-pek['"]/);
  for (const field of ['companyId', 'objectId', 'pekProgramId', 'pekMonitoringId', 'pekControlItemId', 'monitoringPointId', 'protocolTemplateId']) {
    assert.match(api, new RegExp(`payload\\.${field}`), field);
  }
});

test('creation-context query has the exact backend-authoritative key and enablement', async () => {
  const hook = await read('src/features/protocols/hooks/useProtocolCreationContext.ts');
  assert.match(hook, /\['protocol-creation-context', companyId, objectId, date\]/);
  assert.match(hook, /enabled:\s*enabled\s*&&\s*Boolean\(companyId\s*&&\s*objectId\)/);
  assert.match(hook, /getProtocolCreationContext\(\{ companyId, objectId, date \}, signal\)/);
});

test('PEK-first wizard keeps manual creation secondary and clears dependent state', async () => {
  const [wizard, flow] = await Promise.all([
    read('src/features/protocols/components/CreateProtocolWizardModalV2.tsx'),
    read('src/features/protocols/components/PekProtocolCreationFlow.tsx'),
  ]);
  assert.match(wizard, /ProtocolCreationMode = 'PEK' \| 'MANUAL'/);
  assert.match(wizard, /mode === 'PEK'[\s\S]*PekProtocolCreationFlow/);
  assert.match(wizard, /ManualProtocolWizard[\s\S]*BasicDataStep/);
  assert.ok(flow.indexOf('Компания *') < flow.indexOf('Объект *'));
  assert.match(flow, /setCompanyId\(event\.target\.value\); setObjectId\(''\)/);
  assert.match(flow, /key=\{`\$\{companyId\}:\$\{objectId\}`\}/);
  assert.match(flow, /objects\.length === 1[\s\S]*setObjectId/);
  assert.match(flow, />Создать вручную</);
});

test('requirements are point-specific, sorted by urgency and creation respects backend status', async () => {
  const step = await read('src/features/protocols/components/steps/PekProtocolRequirementsStep.tsx');
  const order = ['OVERDUE: 0', 'DUE: 1', 'CONFIGURATION_REQUIRED: 2', 'NOT_DUE: 3', 'COMPLETED: 4'];
  for (let index = 1; index < order.length; index += 1) assert.ok(step.indexOf(order[index - 1]) < step.indexOf(order[index]));
  assert.match(step, /requirement\.id}:\$\{String\(requirement\.monitoringPointId/);
  assert.match(step, /requirement\.status !== 'COMPLETED'/);
  assert.match(step, /requirement\.missingCount > 0/);
  assert.match(step, /Для этой позиции ПЭК не настроен тип протокола/);
  assert.doesNotMatch(step, /monitoringType\s*(?:===|:)|normativeId|normativeValue\s*:/);
});

test('PEK creation handles actionable conflicts and invalidates protocol and PEK data', async () => {
  const step = await read('src/features/protocols/components/steps/PekProtocolRequirementsStep.tsx');
  assert.match(step, /PROTOCOL_DRAFT_ALREADY_EXISTS[\s\S]*Для этой задачи уже существует черновик протокола/);
  assert.match(step, /PROTOCOL_PLAN_ALREADY_COMPLETED[\s\S]*План на этот период уже выполнен/);
  assert.match(step, /Открыть протокол/);
  assert.match(step, /invalidateQueries\(\{ queryKey: \['protocol-creation-context'\] \}\)/);
  assert.match(step, /protocolQueryKeys\.all\(scope\)/);
  assert.match(step, /pekKeys\.root/);
});
