import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Button from '../../../components/ui/Button';
import { useToast } from '../../../hooks/useToast';
import type { PekAvailableAction, PekMutationBody, PekReportIssue, PekReviewComment, PekSectionCode } from '../api/pekContracts';
import { pekKeys } from '../api/pekQueryKeys';
import { pekService } from '../api/pekService';
import PekCollectionProgress from '../components/common/PekCollectionProgress';
import { PekLoading, PekPrimaryAction, PekReadiness, PekState, PekStatusBadge } from '../components/common/PekUi';
import PekQueryError from '../components/common/PekQueryError';
import PekExceedances from '../components/exceedances/PekExceedances';
import PekDocuments from '../components/documents/PekDocuments';
import PekExportMenu from '../components/exports/PekExportMenu';
import PekIssuesPanel from '../components/issues/PekIssuesPanel';
import PekReviewPanel from '../components/review/PekReviewPanel';
import PekHistoryTimeline from '../components/sections/PekHistoryTimeline';
import PekPlanFact from '../components/sections/PekPlanFact';
import PekSectionData from '../components/sections/PekSectionData';
import PekUnmatchedSources from '../components/sections/PekUnmatchedSources';
import PekActionModal from '../components/workflow/PekActionModal';
import PekSignModal from '../components/workflow/PekSignModal';
import PekSubmissionModal from '../components/workflow/PekSubmissionModal';
import { usePekCollection } from '../hooks/usePekCollection';
import { primaryPekAction } from '../utils/pekActions';
import { mapPekError } from '../utils/pekErrorMapper';
import { PEK_STALE_TIME_MS, retryPekQuery } from '../utils/pekQueryPolicy';

const tabToSection: Record<string, PekSectionCode> = {
  overview: 'GENERAL', planFact: 'PROGRAM_EXECUTION', results: 'EMISSIONS',
  exceedances: 'EXCEEDANCES', documents: 'DOCUMENTS', approval: 'REVIEW',
};
const sectionToTab = Object.fromEntries(Object.entries(tabToSection).map(([tab, section]) => [section, tab])) as Partial<Record<PekSectionCode, string>>;

const PekReportWorkspacePage=()=>{const {reportId}=useParams();const id=Number(reportId);const [params,setParams]=useSearchParams();const navigate=useNavigate();const toast=useToast();const client=useQueryClient();const [modalAction,setModalAction]=useState<PekAvailableAction|null>(null);const [issuesOpen,setIssuesOpen]=useState(true);const active=(tabToSection[params.get('tab')||'']||params.get('section')||'GENERAL') as PekSectionCode;
 const queryPolicy={retry:retryPekQuery,staleTime:PEK_STALE_TIME_MS};
 const reportQuery=useQuery({queryKey:pekKeys.report(id),queryFn:({signal})=>pekService.getReport(id,signal),enabled:Boolean(id),...queryPolicy});
 const issuesQuery=useQuery({queryKey:pekKeys.issues(id),queryFn:({signal})=>pekService.getReportIssues(id,signal),enabled:Boolean(id),...queryPolicy});
 const commentsQuery=useQuery({queryKey:pekKeys.comments(id),queryFn:({signal})=>pekService.getReviewComments(id,signal),enabled:Boolean(id),...queryPolicy});
 const sectionQuery=useQuery({queryKey:pekKeys.section(id,active),queryFn:({signal})=>pekService.getReportSection(id,active,signal),enabled:Boolean(id&&active&&!['PROGRAM_EXECUTION','EXCEEDANCES'].includes(active)),...queryPolicy});
 const planQuery=useQuery({queryKey:pekKeys.planFact(id),queryFn:({signal})=>pekService.getPlanFact(id,signal),enabled:active==='PROGRAM_EXECUTION',...queryPolicy});
 const unmatchedQuery=useQuery({queryKey:pekKeys.unmatched(id),queryFn:({signal})=>pekService.getUnmatchedSources(id,signal),enabled:active==='PROGRAM_EXECUTION',...queryPolicy});
 const exceedanceQuery=useQuery({queryKey:pekKeys.exceedances(id),queryFn:({signal})=>pekService.getExceedances(id,signal),enabled:active==='EXCEEDANCES',...queryPolicy});
 const historyQuery=useQuery({queryKey:pekKeys.history(id),queryFn:({signal})=>pekService.getHistory(id,signal),enabled:params.get('view')==='history',...queryPolicy});
 const collection=usePekCollection(id,Boolean(id&&reportQuery.data?.status==='COLLECTING'));
 const refresh=async()=>Promise.all([client.invalidateQueries({queryKey:pekKeys.report(id)}),client.invalidateQueries({queryKey:pekKeys.issues(id)}),client.invalidateQueries({queryKey:pekKeys.comments(id)}),client.invalidateQueries({queryKey:pekKeys.history(id)})]);
 const workflow=useMutation({mutationKey:['pek','workflow',id],mutationFn:async({action,body}:{action:PekAvailableAction;body:PekMutationBody|FormData})=>{if(action.code==='VALIDATE')return pekService.validateReport(id,body as PekMutationBody);if(action.code==='SUBMIT_REVIEW')return pekService.submitReportReview(id,body as PekMutationBody);if(action.code==='START_REVIEW')return pekService.startReview(id,body as PekMutationBody);if(action.code==='RETURN')return pekService.returnReport(id,body as PekMutationBody);if(action.code==='ACCEPT_REVIEW')return pekService.acceptReview(id,body as PekMutationBody);if(action.code==='APPROVE')return pekService.approveReport(id,body as PekMutationBody);if(action.code==='RECALL_APPROVAL')return pekService.recallApproval(id,body as PekMutationBody);if(action.code==='PREPARE_SIGNING')return pekService.prepareSigning(id,body as PekMutationBody).then(()=>pekService.getReport(id));if(action.code==='SIGN')return pekService.signReport(id,body);if(action.code==='REGISTER_SUBMISSION')return pekService.registerSubmission(id,body);if(action.code==='REGISTER_RESULT')return pekService.registerResult(id,body);if(action.code==='CREATE_REVISION')return pekService.createRevision(id,body as PekMutationBody);if(action.code==='ARCHIVE')return pekService.archiveReport(id,body as PekMutationBody);throw new Error('Действие пока недоступно');},retry:false,onSuccess:async(saved)=>{setModalAction(null);await refresh();toast.success('Действие выполнено');if(saved.id!==id)navigate(`/staff/pek/reports/${saved.id}`);},onError:error=>{const parsed=mapPekError(error);toast.error(parsed.message,parsed.traceId?`Код обращения: ${parsed.traceId}`:undefined);}});
 if(reportQuery.isLoading)return <PekLoading/>;if(reportQuery.isError||!reportQuery.data)return <PekQueryError error={reportQuery.error} resource="Отчёт ПЭК" retry={()=>void reportQuery.refetch()}/>;const report=reportQuery.data;const sections=report.sections||[];const activeSection=sections.find(section=>section.code===active);const primary=primaryPekAction(report.availableActions||[]);const readOnly=Boolean(report.readOnly);
 const execute=(action:PekAvailableAction)=>{if(!action.enabled)return;if(action.code==='COLLECT'){if(!collection.collect.isPending)collection.collect.mutate(report.version);return;}if(action.code==='SIGN'){setModalAction(action);return;}if(action.confirmationRequired||action.requiresComment||['APPROVE','RETURN','CREATE_REVISION','REGISTER_SUBMISSION','REGISTER_RESULT'].includes(action.code)){setModalAction(action);return;}workflow.mutate({action,body:{version:report.version}});};
 const navigateIssue=(issue:PekReportIssue)=>{if(issue.sectionCode){const next=new URLSearchParams(params);next.set('tab',sectionToTab[issue.sectionCode]||issue.sectionCode.toLowerCase());next.delete('section');setParams(next);}window.setTimeout(()=>{const selector=issue.rowKey?`[data-row-key="${CSS.escape(issue.rowKey)}"]`:issue.fieldPath?`[name="${CSS.escape(issue.fieldPath)}"]`:'';if(selector){const element=document.querySelector<HTMLElement>(selector);element?.scrollIntoView({behavior:'smooth',block:'center'});element?.focus();}},50);};
 const navigateComment=(comment:PekReviewComment)=>navigateIssue({id:comment.id,code:'REVIEW_COMMENT',severity:'INFO',blocking:comment.mandatory,sectionCode:comment.sectionCode,rowKey:comment.rowKey,fieldPath:comment.fieldPath,message:comment.text,resolved:comment.status==='RESOLVED'});
 return <div className="space-y-4"><header className="rounded-2xl border bg-white p-5"><div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between"><div><Link to="/staff/pek/reports" className="text-sm font-bold text-eco-700">← К отчётам</Link><div className="mt-2 flex flex-wrap items-center gap-3"><h1 className="text-2xl font-black">{report.number}</h1><PekStatusBadge status={report.status}/><span className="text-sm">revision {report.revision}</span></div><p className="mt-2 text-sm text-slate-600">{report.company?.name||'Компания не указана'} · {report.object?.name||'Объект не указан'} · {report.periodStart}—{report.periodEnd}</p></div><div className="flex flex-col items-end gap-2"><PekReadiness value={report.readinessPercent} valid={report.valid}/><PekPrimaryAction action={primary} pending={workflow.isPending||collection.collect.isPending} onClick={execute}/></div></div><div className="mt-4 flex flex-wrap gap-3 text-sm"><span>Ошибки: <b>{report.blockingIssueCount}</b></span><span>Предупреждения: <b>{report.warningCount}</b></span><span>Превышения: <b>{report.exceedanceCount}</b></span>{report.latestValidatedVersion!==report.version&&<span className="font-bold text-amber-700">Проверка устарела</span>}{readOnly&&<span className="font-bold text-slate-600">Режим просмотра</span>}</div></header><PekCollectionProgress run={collection.data} pending={collection.collect.isPending} onRetry={()=>collection.collect.mutate(report.version)}/><PekExportMenu reportId={id} actions={report.availableActions}/>
 <div className={`grid gap-4 ${issuesOpen?'xl:grid-cols-[270px_minmax(0,1fr)_340px]':'xl:grid-cols-[270px_minmax(0,1fr)]'}`}>
  <nav className="rounded-2xl border bg-white p-3 xl:sticky xl:top-24 xl:self-start">
   <Button variant="secondary" type="button" className="mb-2 w-full" aria-expanded={issuesOpen} onClick={()=>setIssuesOpen(value=>!value)}>{issuesOpen?'Скрыть проблемы':'Показать проблемы'}</Button>
   {sections.map(section=><button key={section.code} type="button" onClick={()=>{const next=new URLSearchParams(params);next.set('tab',sectionToTab[section.code]||section.code.toLowerCase());next.delete('section');next.delete('view');setParams(next);}} className={`mb-1 w-full rounded-xl p-3 text-left ${active===section.code?'bg-eco-700 text-white':'hover:bg-slate-50'} ${!section.applicable?'opacity-55':''}`}><span className="block text-sm font-bold">{section.label}</span><span className="text-xs">{section.applicable?`${section.readinessPercent}% · ошибок ${section.errorCount}`:section.notApplicableReason||'Не применяется'}</span></button>)}
   <Link to={`/staff/pek/reports/${id}/history`} className="block w-full rounded-xl p-3 text-left text-sm font-bold">История</Link>
  </nav>
  <main className="min-w-0 rounded-2xl border bg-white p-4 sm:p-5">
   {params.get('view')==='history'
    ? historyQuery.isLoading?<PekLoading/>:historyQuery.isError?<PekState title="Не удалось загрузить историю" retry={()=>void historyQuery.refetch()}/>:<PekHistoryTimeline items={historyQuery.data||[]}/>
    : active==='PROGRAM_EXECUTION'
      ? <div className="space-y-6">
          {planQuery.isLoading?<PekLoading/>:planQuery.isError?<PekState title="Не удалось загрузить план и факт" retry={()=>void planQuery.refetch()}/>:<PekPlanFact rows={planQuery.data||[]}/>}
          {unmatchedQuery.isLoading?<PekLoading/>:unmatchedQuery.isError?<PekState title="Не удалось загрузить несопоставленные источники" retry={()=>void unmatchedQuery.refetch()}/>:<PekUnmatchedSources reportId={id} version={report.version} rows={unmatchedQuery.data||[]} readOnly={readOnly}/>}
        </div>
      : active==='EXCEEDANCES'
        ? exceedanceQuery.isLoading?<PekLoading/>:exceedanceQuery.isError?<PekState title="Не удалось загрузить превышения" retry={()=>void exceedanceQuery.refetch()}/>:<PekExceedances reportId={id} version={report.version} rows={exceedanceQuery.data||[]} readOnly={readOnly}/>
        : activeSection?.applicable===false?<PekState title="Раздел не применяется" message={activeSection.notApplicableReason||'Причина определена backend.'}/>:sectionQuery.isLoading?<PekLoading/>:sectionQuery.isError?<PekState title="Не удалось загрузить раздел" retry={()=>void sectionQuery.refetch()}/>:active==='DOCUMENTS'?<PekDocuments reportId={id} version={report.version} data={sectionQuery.data||{}} readOnly={readOnly}/>:<PekSectionData data={sectionQuery.data||{}}/>}
  </main>
  {issuesOpen&&(issuesQuery.isLoading
    ? <PekLoading/>
    : issuesQuery.isError
      ? <PekState title="Не удалось загрузить проблемы отчёта" message="Нельзя считать отчёт готовым, пока список проблем недоступен." retry={()=>void issuesQuery.refetch()}/>
      : <div><PekIssuesPanel issues={issuesQuery.data||[]} onNavigate={navigateIssue}/>{commentsQuery.isLoading?<PekLoading/>:commentsQuery.isError?<PekState title="Не удалось загрузить замечания" retry={()=>void commentsQuery.refetch()}/>:<PekReviewPanel reportId={id} version={report.version} comments={commentsQuery.data||[]} actions={report.availableActions||[]} onNavigate={navigateComment}/>}</div>)}
 </div>
 <PekActionModal action={modalAction&&['SIGN','REGISTER_SUBMISSION','REGISTER_RESULT'].includes(modalAction.code)?null:modalAction} pending={workflow.isPending} onClose={()=>setModalAction(null)} onConfirm={comment=>modalAction&&workflow.mutate({action:modalAction,body:{version:report.version,comment}})}/><PekSignModal open={modalAction?.code==='SIGN'} reportId={id} version={report.version} pending={workflow.isPending} onClose={()=>setModalAction(null)} onSigned={body=>modalAction&&workflow.mutate({action:modalAction,body})}/><PekSubmissionModal action={modalAction} version={report.version} pending={workflow.isPending} onClose={()=>setModalAction(null)} onSubmit={body=>modalAction&&workflow.mutate({action:modalAction,body})}/></div>;
};
export default PekReportWorkspacePage;
