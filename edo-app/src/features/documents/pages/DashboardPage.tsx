import { Box, Button, Card, CardActionArea, CardContent, Grid, Stack, Typography } from '@mui/material';
import InboxIcon from '@mui/icons-material/Inbox';
import OutboxIcon from '@mui/icons-material/Outbox';
import DrawIcon from '@mui/icons-material/Draw';
import RuleIcon from '@mui/icons-material/Rule';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import BlockIcon from '@mui/icons-material/Block';
import ScheduleIcon from '@mui/icons-material/Schedule';
import DraftsIcon from '@mui/icons-material/Drafts';
import { useNavigate } from 'react-router-dom';
import { PageSkeleton, QueryError } from '../../../shared/components/QueryState';
import { useDashboard } from '../hooks/useDocuments';

const definitions = [
  ['incoming', 'Входящие', <InboxIcon />, '/documents/incoming'],
  ['outgoing', 'Исходящие', <OutboxIcon />, '/documents/outgoing'],
  ['requiresMySignature', 'Ожидают моей подписи', <DrawIcon />, '/documents/waiting-for-me'],
  ['partiallySigned', 'Частично подписаны', <RuleIcon />, '/documents/outgoing?status=PARTIALLY_SIGNED'],
  ['signed', 'Подписаны всеми', <CheckCircleIcon />, '/documents/archive?status=SIGNED'],
  ['rejected', 'Отклонены', <BlockIcon />, '/documents/outgoing?status=REJECTED'],
  ['overdue', 'Просрочены', <ScheduleIcon />, '/documents/incoming?overdue=true'],
  ['drafts', 'Черновики', <DraftsIcon />, '/documents/drafts'],
] as const;

export const DashboardPage = () => {
  const navigate = useNavigate();
  const query = useDashboard();
  if (query.isLoading) return <><Heading /><PageSkeleton rows={6} /></>;
  if (query.isError || !query.data) return <><Heading /><QueryError error={query.error} retry={() => void query.refetch()} /></>;
  return (
    <Stack spacing={4}>
      <Heading />
      <Grid container spacing={2}>
        {definitions.map(([key, label, icon, path]) => (
          <Grid key={key} size={{ xs: 12, sm: 6, lg: 3 }}>
            <Card variant="outlined"><CardActionArea onClick={() => navigate(path)}><CardContent><Stack direction="row" justifyContent="space-between" color="primary.main">{icon}</Stack><Typography variant="h4" fontWeight={900} sx={{ mt: 2 }}>{query.data[key].toLocaleString('ru-RU')}</Typography><Typography color="text.secondary">{label}</Typography></CardContent></CardActionArea></Card>
          </Grid>
        ))}
      </Grid>
      <Box>
        <Typography variant="h5" fontWeight={900}>Типы документов</Typography>
        <Typography color="text.secondary" sx={{ mt: .5, mb: 2 }}>Категории и счётчики загружены из активной организации.</Typography>
        <Grid container spacing={2}>
          {query.data.documentTypes.map((type) => <Grid key={type.id} size={{ xs: 12, md: 6, xl: 4 }}><Card variant="outlined"><CardActionArea onClick={() => navigate(`/documents/${type.direction === 'INCOMING' ? 'incoming' : 'outgoing'}/${type.code}`)}><CardContent><Typography fontWeight={800}>{type.name}</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{type.total ?? '—'} документов · {type.awaitingSignature ?? '—'} ожидают подписи</Typography></CardContent></CardActionArea></Card></Grid>)}
        </Grid>
      </Box>
    </Stack>
  );
};

const Heading = () => (
  <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2}>
    <div><Typography variant="overline" color="primary" fontWeight={800}>Электронный документооборот</Typography><Typography variant="h4" fontWeight={900}>Рабочий стол</Typography><Typography color="text.secondary">Состояние документов активной организации.</Typography></div>
    <Button href="/documents/create" variant="contained">Создать документ</Button>
  </Stack>
);
