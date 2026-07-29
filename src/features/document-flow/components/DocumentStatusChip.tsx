import { Chip } from '@mui/material';

const colors: Record<string, 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info'> = {
  DRAFT: 'default',
  SENT: 'info',
  SIGNING: 'primary',
  PARTIALLY_SIGNED: 'warning',
  SIGNED: 'success',
  REJECTED: 'error',
  REVOKED: 'error',
  ARCHIVED: 'default',
};

export const DocumentStatusChip = ({ status }: { status: string }) => (
  <Chip size="small" color={colors[status] || 'default'} label={status.replace(/_/g, ' ')} />
);
