import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Box, Button, Card, CardContent, CircularProgress, Stack, TextField, Typography, Alert, Container } from '@mui/material';
import { useForm } from 'react-hook-form';
import api from '../../../services/api';
import { useToast } from '../../../hooks/useToast';

interface ForgotPasswordFormValues {
  email: string;
}

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const { error: showError, success: showSuccess } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');
  const form = useForm<ForgotPasswordFormValues>({
    mode: 'onChange',
    defaultValues: { email: '' },
  });

  const onSubmit = async (data: ForgotPasswordFormValues) => {
    setIsLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: data.email.trim() });
      setSubmittedEmail(data.email.trim());
      setIsSubmitted(true);
      showSuccess('Письмо с инструкциями отправлено на почту');
    } catch (err: any) {
      showError(err.response?.data?.message || 'Не удалось отправить письмо');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <Container maxWidth="sm">
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
          <Card sx={{ width: '100%', boxShadow: 3 }}>
            <CardContent sx={{ p: 4 }}>
              <Stack spacing={3} alignItems="center" textAlign="center">
                <Typography variant="h5" fontWeight={800}>Письмо отправлено</Typography>
                <Alert severity="success">
                  <Typography>
                    Проверьте почту <strong>{submittedEmail}</strong>
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    Письмо может прийти в течение нескольких минут. Если не видите, проверьте папку "Спам".
                  </Typography>
                </Alert>
                <Typography variant="body2" color="textSecondary">
                  Ссылка для восстановления пароля действительна 24 часа.
                </Typography>
                <Button
                  fullWidth
                  variant="contained"
                  onClick={() => navigate('/login')}
                  sx={{ mt: 2 }}
                >
                  На страницу входа
                </Button>
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={() => setIsSubmitted(false)}
                >
                  Попробовать другой email
                </Button>
              </Stack>
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
                <Typography variant="h5" fontWeight={800}>Восстановление пароля</Typography>
                <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                  Введите email, связанный с вашим аккаунтом
                </Typography>
              </Box>

              <form onSubmit={form.handleSubmit(onSubmit)}>
                <Stack spacing={2}>
                  <TextField
                    fullWidth
                    type="email"
                    label="Email адрес"
                    {...form.register('email', {
                      required: 'Укажите email',
                      pattern: { value: /^\S+@\S+\.\S+$/, message: 'Укажите корректный email' },
                    })}
                    error={Boolean(form.formState.errors.email)}
                    helperText={form.formState.errors.email?.message}
                  />
                  <Button
                    fullWidth
                    variant="contained"
                    type="submit"
                    disabled={isLoading || !form.formState.isValid}
                    size="large"
                  >
                    {isLoading ? <CircularProgress size={24} /> : 'Отправить письмо'}
                  </Button>
                </Stack>
              </form>

              <Box sx={{ textAlign: 'center' }}>
                <Link to="/login" style={{ textDecoration: 'none' }}>
                  <Button variant="text" size="small">
                    Вернуться к входу
                  </Button>
                </Link>
              </Box>

              <Alert severity="info">
                <Typography variant="body2">
                  На указанный email будет отправлена ссылка для восстановления пароля.
                </Typography>
              </Alert>
            </Stack>
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
}
