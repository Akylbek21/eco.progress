import { Button } from '@mui/material';
import type { PekReport } from '../../api/pekContracts';
import type { PekUser } from '../../permissions/pekAccess';
import {
  canApprovePekReport,
  canArchivePekReport,
  canCollectPekReport,
  canReturnPekReport,
  canSubmitPekReport,
} from '../../permissions/pekAccess';

type Props = {
  report: PekReport;
  user: PekUser;
  isPending: boolean;
  readinessPending?: boolean;
  readinessBlocked?: boolean;
  onCollect: () => void;
  onSubmit: () => void;
  onReturn: () => void;
  onApprove: () => void;
  onArchive: () => void;
};

const PekReportActions = ({
  report,
  user,
  isPending,
  readinessPending = false,
  readinessBlocked = false,
  onCollect,
  onSubmit,
  onReturn,
  onApprove,
  onArchive,
}: Props) => <div className="flex flex-wrap gap-2">
  {canCollectPekReport(user, report) && <Button variant="contained" disabled={isPending} onClick={onCollect}>Собрать данные из протоколов</Button>}
  {canSubmitPekReport(user, report) && <Button variant="contained" disabled={isPending || readinessPending || readinessBlocked} onClick={onSubmit}>{report.status === 'RETURNED' ? 'Повторно отправить на проверку' : 'Отправить на проверку'}</Button>}
  {canReturnPekReport(user, report) && <Button color="warning" variant="outlined" disabled={isPending} onClick={onReturn}>Вернуть на доработку</Button>}
  {canApprovePekReport(user, report) && <Button variant="contained" disabled={isPending || readinessPending} onClick={onApprove}>Утвердить</Button>}
  {canArchivePekReport(user, report) && <Button variant="outlined" disabled={isPending} onClick={onArchive}>Архивировать</Button>}
</div>;

export default PekReportActions;
