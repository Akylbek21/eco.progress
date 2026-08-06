import { Chip } from '@mui/material';
import type { AccessContext } from '../../document-flow/model/types';

export default function AccessStatusChip({ access }: { access: AccessContext | null }) {
  if (!access?.available) return <Chip size="small" label="Недоступен" color="default" />;
  if (access.readOnly) return <Chip size="small" label="Только чтение" color="warning" />;
  return <Chip size="small" label="Доступен" color="success" />;
}

