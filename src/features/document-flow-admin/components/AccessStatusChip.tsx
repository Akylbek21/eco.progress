import { Chip } from '@mui/material';
export default function AccessStatusChip({ access }: { access: { available: boolean; readOnly: boolean } | null }) {
  if (!access?.available) return <Chip size="small" label="Недоступен" color="default" />;
  if (access.readOnly) return <Chip size="small" label="Только чтение" color="warning" />;
  return <Chip size="small" label="Доступен" color="success" />;
}
