import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Button, Card, CardContent, CircularProgress, Stack, TextField, Typography, Alert, Container } from '@mui/material';
import { useForm } from 'react-hook-form';
import api from '../../../services/api';
import { useToast } from '../../../hooks/useToast';

interface ResetPasswordFormValues {
  password: string;
  confirmPassword: string;
}

export default function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { error: showError, success: showSuccess } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [isTokenValid, setIsTokenValid] = useState(false);
  const form = useForm<ResetPasswordFormValues>({
    mode: 'onChange',
    defaultValues: { password: '', confirmPassword: '' },
  });

  useEffect(() => {
    if (!token) {
      showError('Токен восстановления пароля отсутствует');
      return;
    }

    // Validate token
    const validateToken = async () => {
      try {
        await api.post('/auth/validate-reset-token', { token });
        setIsTokenValid(true);
      } catch (err) {
        showError('Ссылка для восстановления пароля недействительна или истекла');
        setIsTokenValid(false);
      } finally {
        setIsValidating(false);
      }
    };

    validateToken();
  }, [token, showError]);

  const onSubmit = async (data: ResetPasswordFormValues) => {
    if (data.password !== data.confirmPassword) {
      form.setError('confirmPassword', { type: 'manual', message: 'Пароли не совпадают' });
      return;
    }

    if (data.password.length < 8) {
      form.setError('password', { type: 'manual', message: 'Пароль должен содержать не менее 8 символов' });
      return;
    }

    setIsLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password: data.password });
      showSuccess('Пароль изменен успешно. Перенаправляем на страницу входа...');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err: any) {
      showError(err.response?.data?.message || 'Не удалось изменить пароль');
    } finally {
      setIsLoading(false);
    }
  };

  if (isValidating) {
    return (
      <Container maxWidth="sm">
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (!isTokenValid) {
    return (
      <Container maxWidth="sm">
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
          <Card sx={{ width: '100%' }}>
            <CardContent>
              <Alert severity="error">
                <Typography>Ссылка для восстановления пароля недействительна или истекла.</Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Попросите отправить вам новую ссылку восстановления пароля.
                </Typography>
              </Alert>
              <Button
                fullWidth
                variant="contained"
                onClick={() => navigate('/forgot-password')}
                sx={{ mt: 2 }}
              >
                Восстановить пароль заново
              </Button>
            </CardContent>
          </Card>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm">
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <Card sx={{ width: '100%', boxShadow: 3 }}>
          <CardContent sx={{ p: 4 }}>
            <Stack spacing={3}>
              <Box>
                <Typography variant="h5" fontWeight={800}>Изменение пароля</Typography>
                <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                  Создайте новый надежный пароль для вашего аккаунта
                </Typography>
              </Box>

              <form onSubmit={form.handleSubmit(onSubmit)}>
                <Stack spacing={2}>
                  <TextField
                    fullWidth
                    type="password"
                    label="Новый пароль"
                    {...form.register('password', {
                      required: 'Укажите пароль',
                      minLength: { value: 8, message: 'Минимум 8 символов' },
                    })}
                    error={Boolean(form.formState.errors.password)}
                    helperText={form.formState.errors.password?.message || 'Минимум 8 символов, содержать цифры и буквы'}
                  />
                  <TextField
                    fullWidth
                    type="password"
                    label="Подтвердите пароль"
                    {...form.register('confirmPassword', {
                      required: 'Подтвердите пароль',
                    })}
                    error={Boolean(form.formState.errors.confirmPassword)}
                    helperText={form.formState.errors.confirmPassword?.message}
                  />
                  <Button
                    fullWidth
                    variant="contained"
                    type="submit"
                    disabled={isLoading || !form.formState.isValid}
                    size="large"
                  >
                    {isLoading ? 'Сохранение...' : 'Изменить пароль'}
                  </Button>
                </Stack>
              </form>

              <Alert severity="info">
                <Typography variant="body2">
                  Используйте надежный пароль с комбинацией букв, цифр и символов.
                </Typography>
              </Alert>
            </Stack>
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
}
