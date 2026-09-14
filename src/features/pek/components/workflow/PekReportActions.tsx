import { Button } from '@mui/material';
import ActionMenu from '../../../../components/ui/ActionMenu';
import type { PekReport } from '../../api/pekContracts';

type Props = {
  report: PekReport;
  isPending: boolean;
  onCollect: () => void;
  onSubmit: () => void;
  onReturn: () => void;
  onApprove: () => void;
  onSubmitAuthority: () => void;
  onAccept: () => void;
  onReject: () => void;
  onArchive: () => void;
};

type VisibleAction = { key: string; label: string; run: () => void };

const PekReportActions = ({ report, isPending, onCollect, onSubmit, onReturn, onApprove, onSubmitAuthority, onAccept, onReject, onArchive }: Props) => {
  const actions: VisibleAction[] = [];
  const allowed = report.availableActions;
  if (allowed.collect === true) actions.push({ key: 'collect', label: 'Получить протоколы', run: onCollect });
  if (allowed.submitReview === true) actions.push({ key: 'submitReview', label: 'Отправить на проверку', run: onSubmit });
  if (allowed.returnForRevision === true) actions.push({ key: 'returnForRevision', label: 'Вернуть на доработку', run: onReturn });
  if (allowed.approve === true) actions.push({ key: 'approve', label: 'Утвердить', run: onApprove });
  if (allowed.submit === true) actions.push({ key: 'submit', label: 'Отметить отчёт как сданный', run: onSubmitAuthority });
  if (allowed.accept === true) actions.push({ key: 'accept', label: 'Отметить принятие отчёта', run: onAccept });
  if (allowed.reject === true) actions.push({ key: 'reject', label: 'Отметить отклонение отчёта', run: onReject });
  if (allowed.archive === true) actions.push({ key: 'archive', label: 'Архивировать', run: onArchive });
  const [primary, ...secondary] = actions;

  return <div className="flex flex-wrap gap-2">
    {primary && <Button variant="contained" disabled={isPending} onClick={primary.run}>{primary.label}</Button>}
    {secondary.length > 0 && <ActionMenu label="Ещё" disabled={isPending}><div className="py-1">{secondary.map(action => <button key={action.key} type="button" className="block w-full px-3 py-2 text-left text-sm font-semibold hover:bg-slate-50" onClick={action.run}>{action.label}</button>)}</div></ActionMenu>}
  </div>;
};

export default PekReportActions;
