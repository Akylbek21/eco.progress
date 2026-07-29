import { Alert, Box, Button, CircularProgress, Skeleton, Stack, Typography } from '@mui/material';
import ReplayIcon from '@mui/icons-material/Replay';
import { mapApiError } from '../api/apiError';

export const PageSkeleton = ({ rows = 5 }: { rows?: number }) => (
  <Stack spacing={2} aria-label="Загрузка" aria-busy="true">
    {Array.from({ length: rows }, (_, index) => <Skeleton key={index} variant="rounded" height={72} />)}
  </Stack>
);

export const QueryError = ({ error, retry }: { error: unknown; retry: () => void }) => {
  const mapped = mapApiError(error);
  return (
    <Alert
      severity="error"
      action={<Button color="inherit" startIcon={<ReplayIcon />} onClick={retry}>Повторить</Button>}
      sx={{ alignItems: 'center' }}
    >
      <Typography fontWeight={800}>Не удалось загрузить данные</Typography>
      <Typography variant="body2">{mapped.message}</Typography>
      {mapped.requestId && <Typography variant="caption">Request ID: {mapped.requestId}</Typography>}
    </Alert>
  );
};

export const EmptyState = ({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) => (
  <Box sx={{ minHeight: 320, display: 'grid', placeItems: 'center', textAlign: 'center', border: '1px dashed', borderColor: 'divider', borderRadius: 3, bgcolor: 'background.paper', p: 4 }}>
    <Box>
      <Typography variant="h6" fontWeight={800}>{title}</Typography>
      <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 480 }}>{text}</Typography>
      {action && <Box sx={{ mt: 3 }}>{action}</Box>}
    </Box>
  </Box>
);

export const FullScreenLoader = () => (
  <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', bgcolor: 'background.default' }}>
    <Stack alignItems="center" spacing={2}><CircularProgress /><Typography color="text.secondary">Проверяем сессию…</Typography></Stack>
  </Box>
);
