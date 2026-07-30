import { useEffect, useState } from 'react';
import { Alert, Button, Checkbox, FormControlLabel, Link as MuiLink, Stack, TextField, Typography } from '@mui/material';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '../api/authApi';
import { authKeys } from '../hooks/useAuthSession';
import { mapApiError } from '../../../shared/api/apiError';
import { useAuthStore } from '../../../shared/auth/authStore';

const schema = z.object({
  email: z.string().email('Введите корректный email'),
  password: z.string().min(1, 'Введите пароль'),
  rememberDevice: z.boolean(),
});
type Values = z.infer<typeof schema>;

const loginMessages: Record<string, string> = {
  INVALID_CREDENTIALS: 'Неверный email или пароль.',
  EMAIL_NOT_VERIFIED: 'Подтвердите email, чтобы продолжить.',
  ACCOUNT_LOCKED: 'Аккаунт заблокирован. Обратитесь к администратору организации.',
  ORGANIZATION_SUSPENDED: 'Работа организации приостановлена.',
  TOO_MANY_ATTEMPTS: 'Слишком много попыток входа. Повторите позже.',
};

export const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const client = useQueryClient();
  const setStatus = useAuthStore((state) => state.setStatus);
  const setActiveOrganization = useAuthStore((state) => state.setActiveOrganization);
  const [error, setError] = useState<{ message: string; requestId?: string }>();
  const [retrySeconds, setRetrySeconds] = useState(0);
  useEffect(() => {
    if (retrySeconds <= 0) return;
    const timer = window.setInterval(() => setRetrySeconds((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [retrySeconds]);
  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '', rememberDevice: false },
  });

  const submit = handleSubmit(async (values) => {
    setError(undefined);
    try {
      await authApi.login(values);
      client.clear();
      const session = await client.fetchQuery({ queryKey: authKeys.session, queryFn: () => authApi.session() });
      setStatus('AUTHENTICATED');
      if (!session.user.emailVerified) return navigate('/verify-email');
      if (!session.organizations.length) return navigate('/onboarding');
      if (session.organizations.length > 1 && !session.activeOrganizationId) return navigate('/select-organization');
      const active = session.activeOrganizationId || session.organizations[0]?.organizationId;
      setActiveOrganization(active);
      const requestedPath = (location.state as { from?: unknown } | null)?.from;
      const safePath = typeof requestedPath === 'string' && requestedPath.startsWith('/') && !requestedPath.startsWith('//')
        ? requestedPath
        : '/dashboard';
      navigate(session.onboardingComplete ? safePath : '/onboarding');
    } catch (requestError) {
      const mapped = mapApiError(requestError, 'Системная ошибка входа. Повторите попытку.');
      const wait = mapped.retryAfterSeconds || (mapped.status === 429 ? 60 : 0);
      setRetrySeconds(wait);
      setError({
        message: mapped.status === 429
          ? `Слишком много попыток входа. Повторите через ${wait} секунд.`
          : (mapped.code && loginMessages[mapped.code]) || mapped.message || 'Не удалось войти.',
        requestId: mapped.requestId,
      });
    }
  });

  return (
    <Stack component="form" onSubmit={submit} spacing={2.5} noValidate>
      <div><Typography variant="h4" fontWeight={900}>Вход</Typography><Typography color="text.secondary" sx={{ mt: 1 }}>Войдите в отдельный кабинет EcoProgress EDO.</Typography></div>
      {error && <Alert severity="error"><Typography variant="body2">{error.message}</Typography>{error.requestId && <Typography variant="caption">Request ID: {error.requestId}</Typography>}</Alert>}
      <Controller name="email" control={control} render={({ field }) => <TextField {...field} label="Email" type="email" autoComplete="email" error={Boolean(errors.email)} helperText={errors.email?.message} />} />
      <Controller name="password" control={control} render={({ field }) => <TextField {...field} label="Пароль" type="password" autoComplete="current-password" error={Boolean(errors.password)} helperText={errors.password?.message} />} />
      <Controller name="rememberDevice" control={control} render={({ field }) => <FormControlLabel control={<Checkbox checked={field.value} onChange={field.onChange} />} label="Запомнить устройство" />} />
      <Button type="submit" variant="contained" size="large" disabled={isSubmitting || retrySeconds > 0}>{isSubmitting ? 'Проверяем данные…' : retrySeconds > 0 ? `Повторить через ${retrySeconds} сек.` : 'Войти'}</Button>
      <Stack direction="row" justifyContent="space-between" flexWrap="wrap" gap={1}>
        <MuiLink component={Link} to="/forgot-password">Забыли пароль?</MuiLink>
        <MuiLink component={Link} to="/register/organization" fontWeight={700}>Зарегистрировать организацию</MuiLink>
      </Stack>
    </Stack>
  );
};
