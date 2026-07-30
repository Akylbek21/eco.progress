import { useState } from 'react';
import { Alert, Box, Button, Checkbox, FormControlLabel, Grid, Stack, Step, StepLabel, Stepper, TextField, Typography } from '@mui/material';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { authApi } from '../../auth/api/authApi';
import { mapApiError } from '../../../shared/api/apiError';

const schema = z.object({
  lastName: z.string().min(2, 'Укажите фамилию'),
  firstName: z.string().min(2, 'Укажите имя'),
  middleName: z.string().optional(),
  userEmail: z.string().email('Некорректный email'),
  userPhone: z.string().regex(/^\+?[0-9 ()-]{10,18}$/, 'Некорректный телефон'),
  password: z.string().min(10, 'Минимум 10 символов').regex(/[A-ZА-Я]/, 'Добавьте заглавную букву').regex(/[0-9]/, 'Добавьте цифру'),
  passwordConfirm: z.string(),
  bin: z.string().regex(/^\d{12}$/, 'БИН состоит из 12 цифр'),
  fullName: z.string().min(3),
  shortName: z.string().min(2),
  directorName: z.string().min(3),
  legalAddress: z.string().min(5),
  actualAddress: z.string().min(5),
  organizationEmail: z.string().email(),
  organizationPhone: z.string().regex(/^\+?[0-9 ()-]{10,18}$/),
  acceptedTerms: z.literal(true, { message: 'Необходимо принять условия' }),
  acceptedPrivacy: z.literal(true, { message: 'Необходимо принять политику' }),
}).refine((data) => data.password === data.passwordConfirm, { path: ['passwordConfirm'], message: 'Пароли не совпадают' });
type Values = z.infer<typeof schema>;

const fieldGroups: Array<Array<keyof Values>> = [
  ['lastName', 'firstName', 'middleName', 'userEmail', 'userPhone', 'password', 'passwordConfirm'],
  ['bin', 'fullName', 'shortName', 'directorName', 'legalAddress', 'actualAddress', 'organizationEmail', 'organizationPhone'],
  ['acceptedTerms', 'acceptedPrivacy'],
];

const labels: Partial<Record<keyof Values, string>> = {
  lastName: 'Фамилия', firstName: 'Имя', middleName: 'Отчество', userEmail: 'Email пользователя', userPhone: 'Телефон пользователя',
  password: 'Пароль', passwordConfirm: 'Повтор пароля', bin: 'БИН', fullName: 'Полное название', shortName: 'Краткое название',
  directorName: 'ФИО руководителя', legalAddress: 'Юридический адрес', actualAddress: 'Фактический адрес',
  organizationEmail: 'Email организации', organizationPhone: 'Телефон организации',
};

export const RegistrationPage = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [requestError, setRequestError] = useState<string>();
  const { control, handleSubmit, trigger, getValues, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { acceptedTerms: false as true, acceptedPrivacy: false as true } as Partial<Values>,
    mode: 'onBlur',
  });

  const next = async () => {
    if (step < 2 && await trigger(fieldGroups[step])) setStep((value) => value + 1);
    else if (step === 2 && await trigger()) setStep(3);
  };
  const submit = handleSubmit(async (values) => {
    setRequestError(undefined);
    try {
      await authApi.register({
        user: { lastName: values.lastName, firstName: values.firstName, middleName: values.middleName, email: values.userEmail, phone: values.userPhone, password: values.password },
        organization: { bin: values.bin, fullName: values.fullName, shortName: values.shortName, directorName: values.directorName, legalAddress: values.legalAddress, actualAddress: values.actualAddress, email: values.organizationEmail, phone: values.organizationPhone },
        acceptedTerms: true,
        acceptedPrivacy: true,
      });
      navigate(`/verify-email?email=${encodeURIComponent(values.userEmail)}`);
    } catch (error) {
      const mapped = mapApiError(error, 'Не удалось завершить регистрацию.');
      setRequestError(`${mapped.message}${mapped.requestId ? ` Request ID: ${mapped.requestId}` : ''}`);
    }
  });

  return (
    <Stack component="form" onSubmit={submit} spacing={3}>
      <div><Typography variant="h4" fontWeight={900}>Новая организация</Typography><Typography color="text.secondary">Создайте отдельный tenant EcoProgress EDO.</Typography></div>
      <Stepper activeStep={step} alternativeLabel>{['Пользователь', 'Организация', 'Проверка', 'Email'].map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}</Stepper>
      {requestError && <Alert severity="error">{requestError}</Alert>}
      {step <= 1 && <Grid container spacing={2}>{(fieldGroups[step] ?? []).map((name) => (
        <Grid key={name} size={{ xs: 12, sm: ['legalAddress', 'actualAddress', 'fullName'].includes(name) ? 12 : 6 }}>
          <Controller name={name} control={control} render={({ field }) => <TextField {...field} value={typeof field.value === 'string' ? field.value : ''} label={labels[name]} type={name.includes('password') ? 'password' : 'text'} error={Boolean(errors[name])} helperText={errors[name]?.message} />} />
        </Grid>
      ))}</Grid>}
      {step === 2 && <Stack spacing={2}>
        <Alert severity="info">Проверьте данные. После регистрации пользователь получит роль OWNER.</Alert>
        <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 2 }}><Typography fontWeight={800}>{getValues('lastName')} {getValues('firstName')}</Typography><Typography variant="body2">{getValues('userEmail')}</Typography><Typography sx={{ mt: 2 }} fontWeight={800}>{getValues('shortName')}</Typography><Typography variant="body2">БИН {getValues('bin')}</Typography></Box>
        <Controller name="acceptedTerms" control={control} render={({ field }) => <FormControlLabel control={<Checkbox checked={Boolean(field.value)} onChange={field.onChange} />} label="Принимаю условия использования" />} />
        <Controller name="acceptedPrivacy" control={control} render={({ field }) => <FormControlLabel control={<Checkbox checked={Boolean(field.value)} onChange={field.onChange} />} label="Принимаю политику конфиденциальности" />} />
        {(errors.acceptedTerms || errors.acceptedPrivacy) && <Alert severity="warning">Подтвердите обязательные согласия.</Alert>}
      </Stack>}
      {step === 3 && <Alert severity="success">Данные готовы к отправке. После создания аккаунта потребуется подтвердить email.</Alert>}
      <Stack direction="row" justifyContent="space-between">
        <Button disabled={step === 0 || isSubmitting} onClick={() => setStep((value) => value - 1)}>Назад</Button>
        {step < 3 ? <Button variant="contained" onClick={() => void next()}>Продолжить</Button> : <Button type="submit" variant="contained" disabled={isSubmitting}>{isSubmitting ? 'Создаём…' : 'Зарегистрировать'}</Button>}
      </Stack>
    </Stack>
  );
};
