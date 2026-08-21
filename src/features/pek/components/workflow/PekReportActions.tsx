import { Button } from '@mui/material';
import type { PekReport } from '../../api/pekContracts';

type Props = {
  report: PekReport;
  isPending: boolean;
  onCollect: () => void;
  onSubmit: () => void;
  onReturn: () => void;
  onApprove: () => void;
  onArchive: () => void;
};

const PekReportActions = ({
  report,
  isPending,
  onCollect,
  onSubmit,
  onReturn,
  onApprove,
  onArchive,
}: Props) => <div className="flex flex-wrap gap-2">
  {report.availableActions.collect === true && <Button variant="contained" disabled={isPending} onClick={onCollect}>{report.lastCollectedAt ? 'Повторить сбор' : 'Собрать протоколы'}</Button>}
  {report.availableActions.submitReview === true && <Button variant="contained" disabled={isPending} onClick={onSubmit}>{report.status === 'RETURNED' ? 'Повторно отправить на проверку' : 'Отправить на проверку'}</Button>}
  {report.availableActions.returnForRevision === true && <Button color="warning" variant="outlined" disabled={isPending} onClick={onReturn}>Вернуть на доработку</Button>}
  {report.availableActions.approve === true && <Button variant="contained" disabled={isPending} onClick={onApprove}>Утвердить</Button>}
  {report.availableActions.archive === true && <Button variant="outlined" disabled={isPending} onClick={onArchive}>Архивировать</Button>}
</div>;

export default PekReportActions;
