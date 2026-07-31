import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, MenuItem, Stack, TextField } from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { documentFlowApi } from '../api/documentFlowApi';
import type { PublicPlan } from '../model/types';

const schema = z.object({
  contactName: z.string().trim().min(2, 'Укажите имя').max(200),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().email('Некорректный email').max(160).or(z.literal('')),
  planCode: z.string().max(40).optional(),
  membersCount: z.coerce.number().int().positive('Количество должно быть больше нуля'),
  comment: z.string().max(2000).optional(),
});
type Form = z.infer<typeof schema>;
type FormInput = z.input<typeof schema>;

export default function AccessRequestForm({ plans }: { plans: PublicPlan[] }) {
  const form = useForm<FormInput, unknown, Form>({
    resolver: zodResolver(schema),
    defaultValues: { contactName: '', phone: '', email: '', planCode: '', membersCount: 1, comment: '' },
  });
  const mutation = useMutation({
    mutationFn: documentFlowApi.requestAccess,
  });
  if (mutation.isSuccess) {
    return <Alert severity="success">Запрос отправлен. Это не активирует подписку автоматически — администрация свяжется с вами.</Alert>;
  }
  return (
    <Stack component="form" spacing={2} onSubmit={form.handleSubmit((value) => mutation.mutate(value))}>
      <TextField label="Контактное лицо" {...form.register('contactName')} error={Boolean(form.formState.errors.contactName)} helperText={form.formState.errors.contactName?.message} />
      <TextField label="Телефон" {...form.register('phone')} />
      <TextField label="Email" {...form.register('email')} error={Boolean(form.formState.errors.email)} helperText={form.formState.errors.email?.message} />
      <TextField select label="Тариф" defaultValue="" {...form.register('planCode')}>
        <MenuItem value="">Не выбран</MenuItem>
        {plans.map((plan) => <MenuItem key={plan.code} value={plan.code}>{plan.nameRu}</MenuItem>)}
      </TextField>
      <TextField type="number" label="Количество сотрудников" {...form.register('membersCount')} error={Boolean(form.formState.errors.membersCount)} helperText={form.formState.errors.membersCount?.message} />
      <TextField label="Комментарий" multiline minRows={3} {...form.register('comment')} />
      {mutation.isError && <Alert severity="error">{mutation.error.message}</Alert>}
      <Button type="submit" variant="contained" disabled={mutation.isPending}>
        {mutation.isPending ? 'Отправка…' : 'Отправить запрос'}
      </Button>
    </Stack>
  );
}
