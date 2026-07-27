import { useState } from 'react';
import Button from '../../../../components/ui/Button';
import { useToast } from '../../../../hooks/useToast';
import type { PekAvailableAction, PekBlobResult } from '../../api/pekContracts';
import { pekService } from '../../api/pekService';
import { mapPekError } from '../../utils/pekErrorMapper';

const save=(result:PekBlobResult)=>{const url=URL.createObjectURL(result.blob);const link=document.createElement('a');link.href=url;link.download=result.filename;link.click();window.setTimeout(()=>URL.revokeObjectURL(url),0);};
const PekExportMenu=({reportId,actions}:{reportId:number;actions:PekAvailableAction[]})=>{const [busy,setBusy]=useState('');const toast=useToast();const run=async(type:string)=>{if(busy)return;setBusy(type);try{const result=type==='preview'?await pekService.downloadPreviewPdf(reportId):type==='pdf'?await pekService.downloadPdf(reportId):type==='xlsx'?await pekService.downloadXlsx(reportId):type==='json'?await pekService.downloadJson(reportId):await pekService.downloadZip(reportId);if(type==='preview'){const url=URL.createObjectURL(result.blob);window.open(url,'_blank','noopener,noreferrer');window.setTimeout(()=>URL.revokeObjectURL(url),60000);}else save(result);}catch(error){toast.error(mapPekError(error).message);}finally{setBusy('');}};const allowed=(code:string)=>actions.some(x=>x.code===code&&x.enabled);return <div className="flex flex-wrap gap-2"><Button variant="secondary" disabled={Boolean(busy)} onClick={()=>void run('preview')}>Предварительный PDF</Button>{[['pdf','DOWNLOAD_PDF','PDF'],['xlsx','DOWNLOAD_XLSX','XLSX'],['json','DOWNLOAD_JSON','JSON'],['zip','DOWNLOAD_ZIP','ZIP']].map(([type,code,label])=>allowed(code)&&<Button key={type} variant="ghost" disabled={Boolean(busy)} onClick={()=>void run(type)}>Скачать {label}</Button>)}</div>};
export default PekExportMenu;
