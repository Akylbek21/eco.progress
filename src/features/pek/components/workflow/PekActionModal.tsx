import { useState } from 'react';
import Button from '../../../../components/ui/Button';
import Modal from '../../../../components/ui/Modal';
import type { PekAvailableAction } from '../../api/pekContracts';

const PekActionModal = ({ action, pending, onClose, onConfirm }: { action: PekAvailableAction | null; pending: boolean; onClose: () => void; onConfirm: (comment: string) => void }) => {
  const [comment,setComment]=useState('');
  if(!action)return null;
  const required=action.requiresComment||['RETURN','CREATE_REVISION'].includes(action.code);
  return <Modal open title={action.label} description={action.disabledReason||'Подтвердите выполнение действия.'} loading={pending} onClose={onClose} footer={<><Button variant="secondary" disabled={pending} onClick={onClose}>Отмена</Button><Button disabled={pending||required&&!comment.trim()} aria-busy={pending} onClick={()=>onConfirm(comment.trim())}>Подтвердить</Button></>}><label className="text-sm font-bold">Комментарий {required&&'*'}<textarea value={comment} onChange={e=>setComment(e.target.value)} rows={4} className="mt-2 w-full rounded-xl border border-slate-300 p-3"/></label></Modal>;
};
export default PekActionModal;
