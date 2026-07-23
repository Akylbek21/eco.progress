import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const sources = Promise.all([
  read('src/pages/ProtocolsPage.tsx'),
  read('src/pages/ProtocolCreatePage.tsx'),
  read('src/pages/ProtocolEditorPage.tsx'),
  read('src/services/apiProtocolService.ts'),
  read('src/utils/protocolPermissions.ts'),
  read('src/types/protocols.ts'),
  read('src/services/apiHelpers.ts'),
  read('src/data/protocolTypeConfig.ts'),
  read('src/App.tsx'),
]);

test('1 list uses server pagination metadata', async () => { const [page, , , api] = await sources; assert.match(page, /data\.last/); assert.match(api, /payload\.totalPages/); assert.doesNotMatch(api, /items\.length === size/); });
test('2 protocol list keeps only the company filter', async () => { const [page] = await sources; assert.match(page, /companyId: companyId \? Number\(companyId\) : undefined/); assert.doesNotMatch(page, /status: status as ProtocolStatus/); });
test('3 protocol list does not expose archive and technical filters', async () => { const [page] = await sources; assert.doesNotMatch(page, /includeArchived/); assert.doesNotMatch(page, /executorId|laboratoryId|complianceStatus/); });
test('4 company filter stays URL-backed', async () => { const [page] = await sources; assert.match(page, /useSearchParams/); assert.match(page, /aria-label="Компания"/); assert.doesNotMatch(page, /searchInput/); });
test('5 creation exposes all canonical backend protocol types', async () => { const [, , , , , types, , config] = await sources; for (const id of ['ambient_air', 'workplace_air', 'soil', 'microclimate', 'lighting', 'noise_vibration', 'water_wastewater', 'uv_emf_laser']) { assert.match(types, new RegExp(`'${id}'`)); assert.match(config, new RegExp(id)); } });
test('6 company selection loads active real objects', async () => { const [, create] = await sources; assert.match(create, /getCompanyObjects/); assert.match(create, /item\.status === 'ACTIVE' && !item\.virtual/); });
test('7 company change clears objectId', async () => { const [, create] = await sources; assert.match(create, /objectId: ''/); });
test('8 laboratory selection loads active employees', async () => { const [, create] = await sources; assert.match(create, /getLaboratoryEmployees/); assert.match(create, /items\.filter\(\(item\) => item\.active/); });
test('9 laboratory change clears executorId', async () => { const [, create] = await sources; assert.match(create, /executorId: ''/); });
test('10 quick-create sends laboratory employee id as executorId', async () => { const [, create] = await sources; assert.match(create, /const executorId = Number\(executor\.id\)/); assert.match(create, /executorId,/); });
test('11 sampleDate is canonical and persisted', async () => { const [, create] = await sources; const mapper = await read('src/features/protocols/api/protocolMappers.ts'); assert.match(create, /sampleDate: form\.sampleDate/); assert.match(mapper, /sampleDate: optionalText\(payload\.sampleDate/); });
test('12 measurementTime is persisted', async () => { const [, , , api] = await sources; assert.match(api, /measurementTime: payload\.measurementTime/); });
test('13 measurementPlace is persisted and verified', async () => { const [, , , api] = await sources; assert.match(api, /\['measurementPlace', payload\.measurementPlace, protocol\.measurementPlace\]/); });
test('14 result mutations use protocol result endpoints', async () => { const [, , , api] = await sources; assert.match(api, /protocols\/\$\{protocolId\}\/results/); });
test('15 measurement device survives quick-create payload mapping', async () => { const [, create] = await sources; assert.match(create, /measurementDeviceId:/); });
test('16 normative search is paginated and abortable', async () => { const [, , , api] = await sources; assert.match(api, /searchNormative\(params: Record<string, string>, signal\?: AbortSignal/); assert.match(api, /signal/); });
test('17 missing result unit participates in validation', async () => { const [, create] = await sources; assert.match(create, /measurements\.find\(\(item\) => !item\.unit/); assert.match(create, /String\(item\.unit\)\.trim/); });
test('18 soil quick-create keeps sample number and depth', async () => { const [, create] = await sources; assert.match(create, /sampleNumber/); assert.match(create, /samplingDepth/); });
test('19 water creation maps water_wastewater to backend water', async () => { const mapper = await read('src/features/protocols/api/protocolTypeMapper.ts'); assert.match(mapper, /value === 'water_wastewater' \? 'water'/); });
test('20 sending for approval requires confirmation', async () => { const [, , editor] = await sources; assert.match(editor, /Передать протокол на проверку\?/); assert.match(editor, /markReadyForApproval/); });
test('21 backend workflow errors are normalized and rendered', async () => { const [, , editor] = await sources; assert.match(editor, /normalizeProtocolError/); assert.match(editor, /workflowErrors\.map/); });
test('22 revision requires a dedicated reason modal', async () => { const modal = await read('src/components/protocols/ReturnForRevisionModal.tsx'); assert.match(modal, /required: 'Укажите причину возврата'/); assert.match(modal, /useForm<FormValues>/); });
test('23 HEAD can approve', async () => { const [, , , , permissions] = await sources; assert.match(permissions, /headRoles = new Set\(\['ADMIN', 'DIRECTOR', 'HEAD'\]\)/); assert.match(permissions, /canApproveProtocol/); });
test('24 LABORATORY cannot approve', async () => { const [, , , , permissions] = await sources; assert.doesNotMatch(permissions.match(/headRoles[^;]+/)?.[0] || '', /LABORATORY/); });
test('25 signing is restricted to APPROVED and blocks expired devices', async () => { const sign = await read('src/components/protocols/SignProtocolModal.tsx'); const [, , , , permissions] = await sources; assert.match(permissions, /statusOf\(protocol\) === 'APPROVED'/); assert.match(sign, /expiredDevices > 0/); });
test('26 one readOnly flag is derived from canEditProtocol', async () => { const [, , editor] = await sources; assert.match(editor, /readOnly = useMemo\(\(\) => !canEditProtocol\(user, protocol\)/); });
test('27 PDF download is a blob with server filename support', async () => { const [, , , api] = await sources; assert.match(api, /responseType: 'blob'/); assert.match(api, /content-disposition/i); });
test('28 file storage 503 is converted to a user message', async () => { const [, , , , , , errors] = await sources; assert.match(errors, /503/); assert.doesNotMatch(errors, /return.*AxiosError/); });
test('29 optimistic lock sends version and waits for explicit refresh', async () => { const [, , editor] = await sources; const mapper = await read('src/features/protocols/api/protocolMappers.ts'); assert.match(mapper, /version: payload\.version/); assert.match(editor, /Протокол был изменён другим сотрудником/); assert.doesNotMatch(editor.match(/if \(getApiStatus\(saveError\) === 409\)[\s\S]*?\} else/)?.[0] || '', /protocolService\.updateProtocol/); });
test('30 signed protocol can create a correction with reason', async () => { const [, , editor, , permissions] = await sources; assert.match(editor, /ReplaceProtocolModal/); assert.match(permissions, /statusOf\(protocol\) === 'SIGNED'/); });
test('31 history timeline uses protocol history records', async () => { const [, , editor] = await sources; assert.match(editor, /protocol\.history/); assert.match(editor, /History/); });
test('32 unsaved changes guard page refresh and internal navigation', async () => { const [, , editor] = await sources; assert.match(editor, /beforeunload/); assert.match(editor, /navigateSafely/); });
test('33 protocol list keeps row navigation and actions as sibling buttons', async () => { const list = await read('src/components/protocols/ProtocolList.tsx'); assert.match(list, /<tr key=\{protocol\.id\}[^>]*onClick=/); assert.match(list, /<td[^>]*onClick=\{\(event\) => event\.stopPropagation\(\)\}/); });
test('34 view and edit routes share the guarded editor', async () => { const [, , , , , , , , app] = await sources; assert.match(app, /staff\/protocols\/:protocolId\/edit/); assert.match(app, /StaffAccess roles=\{protocolRoles\}/); });
test('35 correction uses only the confirmed plural endpoint', async () => { const [, , , api] = await sources; assert.match(api, /protocols\/\$\{protocolId\}\/corrections/); assert.doesNotMatch(api, /protocols\/\$\{protocolId\}\/correction[`']/); assert.doesNotMatch(api, /protocols\/\$\{protocolId\}\/(duplicate|copy)/); });
test('36 READY remains a distinct backend status', async () => { const [, , , , , types] = await sources; const status = await read('src/config/protocolStatus.ts'); assert.match(types, /\| 'READY'/); assert.doesNotMatch(status, /READY:\s*'READY_FOR_APPROVAL'/); });
