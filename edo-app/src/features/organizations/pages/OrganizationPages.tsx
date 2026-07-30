import { useState } from 'react';
import { Alert, Button, Card, CardContent, Chip, Grid, LinearProgress, Stack, Step, StepLabel, Stepper, Typography } from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { organizationsApi } from '../api/organizationsApi';
import { authKeys, useAuthSession } from '../../auth/hooks/useAuthSession';
import { useAuthStore } from '../../../shared/auth/authStore';
import { PageSkeleton, QueryError } from '../../../shared/components/QueryState';

export const OrganizationSelectorPage = () => {
  const navigate = useNavigate();
  const client = useQueryClient();
  const setActive = useAuthStore((state) => state.setActiveOrganization);
  const query = useQuery({ queryKey: authKeys.organizations, queryFn: ({ signal }) => organizationsApi.list(signal) });
  const [pending, setPending] = useState<string>();
  const activate = async (id: string) => {
    setPending(id);
    try {
      await organizationsApi.activate(id);
      setActive(id);
      client.removeQueries({ predicate: (item) => item.queryKey[0] !== 'auth' });
      await client.invalidateQueries({ queryKey: authKeys.session });
      navigate('/dashboard');
    } finally { setPending(undefined); }
  };
  if (query.isLoading) return <PageSkeleton />;
  if (query.isError) return <QueryError error={query.error} retry={() => void query.refetch()} />;
  return <Stack spacing={3} sx={{ maxWidth: 1000, mx: 'auto', py: 6, px: 2 }}><div><Typography variant="h4" fontWeight={900}>Выберите организацию</Typography><Typography color="text.secondary">Данные организаций изолированы. БИН отображается в маскированном виде.</Typography></div><Grid container spacing={2}>{query.data?.map((organization) => <Grid key={organization.organizationId} size={{ xs: 12, md: 6 }}><Card variant="outlined"><CardContent><Stack direction="row" justifyContent="space-between"><Typography variant="h6" fontWeight={800}>{organization.organizationName}</Typography><Chip label={organization.status} /></Stack><Typography sx={{ mt: 2 }}>БИН {organization.binMasked}</Typography><Typography color="text.secondary">{organization.role}</Typography><Button fullWidth variant="contained" sx={{ mt: 3 }} disabled={Boolean(pending)} onClick={() => void activate(organization.organizationId)}>{pending === organization.organizationId ? 'Открываем…' : 'Открыть'}</Button></CardContent></Card></Grid>)}</Grid></Stack>;
};

export const OnboardingPage = () => {
  const navigate = useNavigate();
  const session = useAuthSession();
  const progress = session.data?.onboardingComplete ? 100 : 17;
  const steps = ['Заполнить профиль организации', 'Пригласить сотрудников', 'Добавить контрагента', 'Создать первый документ', 'Проверить NCALayer', 'Настроить уведомления'];
  return <Stack spacing={3} sx={{ maxWidth: 900, mx: 'auto', py: 6, px: 2 }}><div><Typography variant="h4" fontWeight={900}>Настройка EcoProgress EDO</Typography><Typography color="text.secondary">Прогресс приходит с backend и не рассчитывается по фиктивным данным.</Typography></div><LinearProgress variant="determinate" value={progress} /><Stepper orientation="vertical" activeStep={session.data?.onboardingComplete ? steps.length : 0}>{steps.map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}</Stepper><Alert severity="info">Пропуск шага разрешается только если backend вернёт соответствующее действие.</Alert><Button variant="contained" onClick={() => navigate('/dashboard')}>Перейти в кабинет</Button></Stack>;
};
