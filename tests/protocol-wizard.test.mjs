import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('protocol list opens the wizard without navigating to a creation page', async () => {
  const page = await read('src/pages/ProtocolsPage.tsx');
  assert.match(page, /setCreateModalOpen\(true\)/);
  assert.match(page, /<CreateProtocolWizardModal/);
  assert.doesNotMatch(page, /navigate\('\/staff\/protocols\/create'/);
  assert.match(page, /invalidateQueries\(\{ queryKey: \['protocols'\] \}\)/);
  assert.match(page, /navigate\(`\/staff\/protocols\/\$\{protocol\.id\}`\)/);
});

test('wizard has nine guarded steps and one quick-create mutation', async () => {
  const wizard = await read('src/features/protocols/components/CreateProtocolWizardModal.tsx');
  assert.match(wizard, /const steps = \[[^\]]*'Создание'\]/);
  assert.match(wizard, /submittingRef\.current \|\| mutation\.isPending/);
  assert.match(wizard, /protocolService\.quickCreateProtocol\(payload, idempotencyKeyRef\.current\)/);
  assert.match(wizard, /crypto\.randomUUID\(\)/);
  assert.doesNotMatch(wizard, /protocolService\.createProtocol/);
  assert.match(wizard, /closeOnBackdrop=\{false\}/);
  assert.match(wizard, /document\.getElementById\('wizard-step-title'\)/);
});

test('wizard persists and clears the session draft', async () => {
  const wizard = await read('src/features/protocols/components/CreateProtocolWizardModal.tsx');
  assert.match(wizard, /protocol-create-wizard-draft/);
  assert.match(wizard, /sessionStorage\.setItem\(DRAFT_KEY/);
  assert.match(wizard, /sessionStorage\.getItem\(DRAFT_KEY/);
  assert.match(wizard, /sessionStorage\.removeItem\(DRAFT_KEY\)/);
  assert.match(wizard, /Найдена незавершённая форма протокола/);
});

test('wizard payload mapper filters empty rows, maps water and sends canonical environment', async () => {
  const mapper = await read('src/features/protocols/mappers/mapProtocolWizardToRequest.ts');
  const api = await read('src/services/apiProtocolService.ts');
  assert.match(mapper, /filter\(isNonEmptyResult\)/);
  assert.match(mapper, /mapFrontendProtocolType\(form\.templateId\)/);
  assert.match(mapper, /conditions: mapConditions\(form\)/);
  assert.match(mapper, /environment:/);
  assert.match(mapper, /manualChangeReason:/);
  assert.doesNotMatch(api, /environment: _unsupportedEnvironment/);
  assert.match(api, /'Idempotency-Key'/);
});

test('result rows validate device date and chemical or physical codes', async () => {
  const wizard = await read('src/features/protocols/components/CreateProtocolWizardModal.tsx');
  const devices = await read('src/features/protocols/components/components/DeviceSelector.tsx');
  assert.match(wizard, /CHEMICAL_TYPES\.has\(values\.templateId\)/);
  assert.match(wizard, /укажите код загрязняющего вещества/);
  assert.match(wizard, /укажите тип физического фактора/);
  assert.match(wizard, /isDeviceValidForDate\(device,values\.measurementDate\)/);
  assert.match(devices, /VALID|isDeviceValidForDate/);
});

test('modal does not reset input focus when its callback changes during typing', async () => {
  const modal = await read('src/components/ui/Modal.tsx');
  assert.match(modal, /const onCloseRef = useRef\(onClose\)/);
  assert.match(modal, /const loadingRef = useRef\(loading\)/);
  assert.match(modal, /\}, \[visible\]\);/);
  assert.doesNotMatch(modal, /\[visible, loading, onClose\]/);
});

test('wizard loads environment conditions automatically', async () => {
  const wizard = await read('src/features/protocols/components/CreateProtocolWizardModal.tsx');
  const environment = await read('src/features/protocols/components/steps/EnvironmentStep.tsx');
  assert.match(wizard, /protocolService\.getWeatherConditions/);
  assert.match(wizard, /values\.sampleDate \|\| values\.measurementDate/);
  assert.match(wizard, /weather\.pressureKpa \|\| weather\.pressure/);
  assert.match(wizard, /enabled: open && Boolean\(values\.objectId && weatherCoordinates/);
  assert.match(wizard, /getCompanyObject\(values\.companyId, values\.objectId, signal\)/);
  assert.match(environment, /Загружаем условия среды/);
});
