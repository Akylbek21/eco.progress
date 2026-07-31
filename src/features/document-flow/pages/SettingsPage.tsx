import { Alert, Stack, Typography } from '@mui/material';
export default function SettingsPage() {
  return <Stack spacing={2}><Typography variant="h4" fontWeight={800}>Настройки</Typography><Alert severity="info">В текущем backend Document Flow отдельные endpoints настроек модуля отсутствуют. Локальные псевдонастройки не создаются.</Alert></Stack>;
}
