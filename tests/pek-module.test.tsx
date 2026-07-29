// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { pekService } from '../src/features/pek/api/pekService';
import { mapPekPage } from '../src/features/pek/api/pekMappers';
import { mapPekError, pekIssueMessage } from '../src/features/pek/utils/pekErrorMapper';
import { primaryPekAction } from '../src/features/pek/utils/pekActions';
import { pekStatusLabels } from '../src/features/pek/utils/pekLabels';
import { retryPekQuery } from '../src/features/pek/utils/pekQueryPolicy';
import PekPlanFact from '../src/features/pek/components/sections/PekPlanFact';
import PekIssuesPanel from '../src/features/pek/components/issues/PekIssuesPanel';
import { PekPrimaryAction } from '../src/features/pek/components/common/PekUi';
import { createWizardDefaults } from '../src/features/protocols/components/wizardTypes';
import { buildQuickCreatePayload } from '../src/features/protocols/mappers/mapProtocolWizardToRequest';
import { formatPekResult } from '../src/features/pek/utils/pekFormatters';

let captured: unknown;
let capturedIfMatch: string | null;
const server=setupServer(
  http.get('*/api/pek/programs',({request})=>HttpResponse.json({data:{content:[{id:1,number:'ПЭК-1'}],number:0,size:20,totalElements:1,totalPages:1},query:new URL(request.url).searchParams.get('search')})),
  http.post('*/api/pek/programs',async({request})=>{captured=await request.json();return HttpResponse.json({data:{id:7,...captured}});}),
  http.post('*/api/pek/reports/:id/collect',async({request})=>{captured=await request.json();capturedIfMatch=request.headers.get('If-Match');return HttpResponse.json({data:{id:3,status:'RUNNING',progressPercent:10,processedRows:2,foundIssues:0}});}),
  http.post('*/api/pek/reports',async({request})=>{captured=await request.json();return HttpResponse.json({data:{id:18,version:1,status:'COLLECTING'}});}),
  http.get('*/api/pek/settings',()=>HttpResponse.json({data:{collectionPollingIntervalMs:1500,autosaveDebounceMs:1200,version:4}})),
  http.patch('*/api/pek/settings',async({request})=>{captured=await request.json();capturedIfMatch=request.headers.get('If-Match');return HttpResponse.json({data:{...captured,version:5}});}),
  http.get('*/api/pek/reports/:reportId/unmatched-sources/:sourceId/link-options',()=>HttpResponse.json({data:[{id:31,name:'СЗЗ-1',indicators:[{id:71,name:'Пыль'}]}]})),
);
beforeAll(()=>server.listen({onUnhandledRequest:'error'}));
afterEach(()=>{cleanup();captured=undefined;capturedIfMatch=null;server.resetHandlers();});
afterAll(()=>server.close());

describe('production PEK module',()=>{
  it('uses real paginated programs API and preserves server totals',async()=>{
    const page=await pekService.getPrograms({search:'СЗЗ',page:0,size:20});
    expect(page.content[0]).toMatchObject({id:1,number:'ПЭК-1'});
    expect(page.totalElements).toBe(1);
  });
  it('sends one complete program create request',async()=>{
    await pekService.createProgram({companyId:1,objectId:15,number:'ПЭК-1',name:'Контроль',version:1,validFrom:'2026-01-01',validUntil:'2026-12-31',controlItems:[],indicators:[],measures:[]});
    expect(captured).toMatchObject({companyId:1,objectId:15,name:'Контроль'});
  });
  it('collect sends current version and returns polling status',async()=>{
    const run=await pekService.collectReport(9,{version:12});
    expect(captured).toEqual({});
    expect(capturedIfMatch).toBe('12');
    expect(run.status).toBe('RUNNING');
  });
  it('creates a report with backend-managed collection in one command',async()=>{
    const report=await pekService.createReport({companyId:1,objectId:15,periodType:'QUARTER',year:2026,quarter:2,programId:7,collect:true});
    expect(report).toMatchObject({id:18,status:'COLLECTING'});
    expect(captured).toEqual({companyId:1,objectId:15,periodType:'QUARTER',year:2026,quarter:2,programId:7,collect:true});
  });
  it('normalizes array and paged response shapes',()=>{
    expect(mapPekPage<number>([1,2]).totalElements).toBe(2);
    expect(mapPekPage<number>({data:{items:[3],page:2,size:10,total:21}})).toMatchObject({content:[3],page:2,totalElements:21,totalPages:3});
  });
  it('renders event completion and indicator completeness separately',()=>{
    render(<MemoryRouter><PekPlanFact rows={[{id:'row-1',controlItem:'СЗЗ-1',source:'Точка 1',frequency:'Квартально',plannedEvents:4,actualEvents:2,eventCompletionPercent:50,plannedIndicators:8,foundIndicators:6,indicatorCompletenessPercent:75,status:'PARTIAL',protocolIds:[31],issueCount:1}]}/></MemoryRouter>);
    expect(screen.getByText('50%')).toBeTruthy();
    expect(screen.getByText('75%')).toBeTruthy();
    expect(screen.getByRole('link',{name:'№31'}).getAttribute('href')).toBe('/staff/protocols/31');
  });
  it('uses backend availableActions and shows disabled reason',()=>{
    const actions=[{code:'SIGN' as const,label:'Подписать',enabled:false,disabledReason:'Нет права подписи'},{code:'DOWNLOAD_PDF' as const,label:'PDF',enabled:true}];
    const action=actions[0];
    const click=vi.fn();
    render(<PekPrimaryAction action={action} onClick={click}/>);
    expect((screen.getByRole('button',{name:'Подписать'}) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Нет права подписи')).toBeTruthy();
  });
  it('maps issue codes and navigates to the selected issue',()=>{
    const navigate=vi.fn();
    const issue={id:1,code:'PEK_REQUIRED_PROTOCOL_MISSING',severity:'ERROR' as const,blocking:true,message:'technical',resolved:false,sectionCode:'EMISSIONS' as const};
    render(<PekIssuesPanel issues={[issue]} onNavigate={navigate}/>);
    expect(screen.getByText('Не найден обязательный протокол для позиции контроля')).toBeTruthy();
    fireEvent.click(screen.getByRole('button'));
    expect(navigate).toHaveBeenCalledWith(issue);
    expect(pekIssueMessage(issue)).not.toContain('PEK_');
  });
  it('maps backend errors without exposing stack or raw status text',()=>{
    const error={isAxiosError:true,response:{status:409,data:{code:'VERSION_CONFLICT',message:'Request failed with status code 409',fieldErrors:{'environment.temperature':'Обязательное поле'},traceId:'trace-7'}},message:'raw'};
    const mapped=mapPekError(error);
    expect(mapped.message).toBe('Отчёт изменён другим сотрудником');
    expect(mapped.fieldErrors['environment.temperature']).toBe('Обязательное поле');
    expect(mapped.traceId).toBe('trace-7');
  });
  it('passes PEK links to protocol quick-create and keeps executor as laboratory employee',()=>{
    const form={...createWizardDefaults(),templateId:'ambient_air' as const,companyId:'1',objectId:'15',laboratoryId:'3',executorId:'8',pekProgramId:'22',pekControlItemId:'31',pekControlEventId:'80',pekReportId:'45',monitoringPointId:'7'};
    const payload=buildQuickCreatePayload(form,{validationMode:'draft'});
    expect(payload).toMatchObject({companyId:1,objectId:15,executorId:8,pekProgramId:22,pekControlItemId:31,pekControlEventId:80,pekReportId:45,monitoringPointId:7});
  });
  it('prefers an enabled backend action over a disabled action',()=>{
    const action=primaryPekAction([
      {code:'COLLECT',label:'Собрать',enabled:false,disabledReason:'Сбор уже идёт'},
      {code:'VALIDATE',label:'Проверить',enabled:true},
    ]);
    expect(action?.code).toBe('VALIDATE');
  });
  it('centralizes user-facing status labels',()=>{
    expect(pekStatusLabels.READY_FOR_APPROVAL).toBe('Готов к утверждению');
    expect(pekStatusLabels.REQUIRES_CORRECTION).toBe('Требует исправления');
  });
  it('retries only transient query failures',()=>{
    expect(retryPekQuery(0,{response:{status:503}})).toBe(true);
    expect(retryPekQuery(0,{response:{status:404}})).toBe(false);
    expect(retryPekQuery(2,{response:{status:503}})).toBe(false);
  });
  it('loads and saves PEK settings through backend',async()=>{
    const settings=await pekService.getSettings();
    expect(settings.version).toBe(4);
    await pekService.updateSettings({...settings,autosaveDebounceMs:900});
    expect(captured).toMatchObject({autosaveDebounceMs:900});
    expect(captured).not.toHaveProperty('version');
    expect(capturedIfMatch).toBe('4');
  });
  it('loads backend link options instead of accepting internal ids from a text field',async()=>{
    const options=await pekService.getUnmatchedLinkOptions(12,44);
    expect(options[0]).toMatchObject({id:31,name:'СЗЗ-1'});
    expect(options[0].indicators[0]).toMatchObject({id:71,name:'Пыль'});
  });
  it('formats zero, negative, ranges and less-than-detection results without losing values',()=>{
    expect(formatPekResult(0)).toBe('0');
    expect(formatPekResult(-0.5)).toBe('-0.5');
    expect(formatPekResult({numericValue:0})).toBe('0');
    expect(formatPekResult({rangeFrom:0,rangeTo:2})).toBe('0–2');
    expect(formatPekResult({belowDetectionLimit:true,detectionLimit:0.01})).toBe('< 0.01');
    expect(formatPekResult(null)).toBe('—');
  });
});
