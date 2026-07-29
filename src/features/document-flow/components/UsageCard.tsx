import { Alert, Box, LinearProgress, Paper, Typography } from '@mui/material';
import { usagePercent } from '../utils/access';

export const UsageCard = ({
  label,
  used,
  limit,
  format = (value) => String(value),
}: {
  label: string;
  used?: number;
  limit?: number;
  format?: (value: number) => string;
}) => {
  const percent = usagePercent(used, limit);
  return (
    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="h6" fontWeight={900} sx={{ mt: 0.5 }}>
        {used === undefined ? '—' : format(used)} / {limit === undefined ? '—' : format(limit)}
      </Typography>
      {percent !== null && <LinearProgress variant="determinate" value={percent} color={percent >= 100 ? 'error' : percent >= 80 ? 'warning' : 'primary'} sx={{ mt: 1.5, height: 7, borderRadius: 9 }} />}
      {percent !== null && percent >= 80 && <Alert severity={percent >= 100 ? 'error' : 'warning'} sx={{ mt: 1.5, py: 0 }}>{percent >= 100 ? 'Лимит исчерпан' : 'Использовано более 80%'}</Alert>}
    </Paper>
  );
};

