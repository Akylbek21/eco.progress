import { useState } from 'react';
import { Alert, Button, Stack, TextField, Typography } from '@mui/material';
import { useSearchParams, Link } from 'react-router-dom';
import { authApi } from '../api/authApi';
import { mapApiError } from '../../../shared/api/apiError';

export const VerifyEmailPage = () => {
  const [params] = useSearchParams();
  const [code, setCode] = useState('');
  const [state, setState] = useState<string>();
  const verify = async () => {
    try {
      await authApi.verifyEmail({ code: code || undefined, token: params.get('token') || undefined });
      setState('Email подтверждён. Теперь можно войти.');
    } catch (error) { setState(mapApiError(error, 'Не удалось подтвердить email.').message); }
  };
  return <Stack spacing={2.5}><Typography variant="h4" fontWeight={900}>Подтверждение email</Typography><Typography color="text.secondary">Введите код из письма или откройте страницу по ссылке подтверждения.</Typography>{state && <Alert severity={state.includes('подтверждён') ? 'success' : 'error'}>{state}</Alert>}<TextField label="Код подтверждения" value={code} onChange={(event) => setCode(event.target.value)} /><Button variant="contained" onClick={() => void verify()}>Подтвердить</Button><Button onClick={() => void authApi.resendVerification().then(() => setState('Новое письмо отправлено. Повторная отправка будет доступна позже.')).catch((error) => setState(mapApiError(error).message))}>Отправить код повторно</Button><Button component={Link} to="/login">Вернуться ко входу</Button></Stack>;
};

export const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  return <Stack spacing={2.5}><Typography variant="h4" fontWeight={900}>Восстановление пароля</Typography>{sent ? <Alert severity="success">Если аккаунт существует, инструкция отправлена на указанный email.</Alert> : <><Typography color="text.secondary">Мы не сообщаем, зарегистрирован ли конкретный email.</Typography><TextField label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} /><Button variant="contained" onClick={() => void authApi.forgotPassword(email).finally(() => setSent(true))}>Отправить ссылку</Button></>}<Button component={Link} to="/login">Вернуться ко входу</Button></Stack>;
};

export const ResetPasswordPage = () => {
  const [params] = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [state, setState] = useState<string>();
  const submit = async () => {
    if (password.length < 10 || password !== confirm) return setState('Пароли должны совпадать и содержать минимум 10 символов.');
    try { await authApi.resetPassword(params.get('token') || '', password); setState('Пароль изменён. Активные сессии завершены согласно политике безопасности.'); }
    catch (error) { setState(mapApiError(error).message); }
  };
  return <Stack spacing={2.5}><Typography variant="h4" fontWeight={900}>Новый пароль</Typography>{state && <Alert severity={state.startsWith('Пароль изменён') ? 'success' : 'error'}>{state}</Alert>}<TextField label="Новый пароль" type="password" value={password} onChange={(event) => setPassword(event.target.value)} /><TextField label="Повтор пароля" type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} /><Button variant="contained" onClick={() => void submit()}>Сохранить пароль</Button><Button component={Link} to="/login">Перейти ко входу</Button></Stack>;
};
