import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, MenuItem, Stack, TextField } from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { documentFlowApi } from '../api/documentFlowApi';
import type { AccessRequestPayload, PublicPlan } from '../model/types';

const schema = z.object({
  organizationName: z.string().trim().min(2, 'Укажите название организации').max(300),
  bin: z.string().trim().min(5, 'Укажите БИН или ИИН').max(20),
  contactName: z.string().trim().min(2, 'Укажите имя').max(200),
  phone: z.string().trim().min(5, 'Укажите телефон').max(40),
  email: z.string().trim().email('Некорректный email').max(160),
  planCode: z.string().max(40).optional(),
  membersCount: z.coerce.number().int().positive('Количество должно быть больше нуля'),
  comment: z.string().max(2000).optional(),
});
type Form = z.infer<typeof schema>;
type FormInput = z.input<typeof schema>;

export const toAccessRequestPayload = ({ organizationName, bin, comment, ...value }: Form): AccessRequestPayload => ({
  ...value,
  comment: [`Организация: ${organizationName}`, `БИН/ИИН: ${bin}`, comment?.trim()].filter(Boolean).join('\n'),
});

interface Props {
  plans: PublicPlan[];
  initialOrganizationName?: string;
  initialBin?: string;
}

export default function AccessRequestForm({ plans, initialOrganizationName = '', initialBin = '' }: Props) {
  const form = useForm<FormInput, unknown, Form>({
    resolver: zodResolver(schema),
    defaultValues: { organizationName: initialOrganizationName, bin: initialBin, contactName: '', phone: '', email: '', planCode: '', membersCount: 1, comment: '' },
  });
  const mutation = useMutation({
    mutationFn: (value: Form) => documentFlowApi.requestAccess(toAccessRequestPayload(value)),
  });
  if (mutation.isSuccess) {
    return <Alert severity="success">Запрос отправлен. Это не активирует подписку автоматически — администрация свяжется с вами.</Alert>;
  }
  return (
    <Stack component="form" spacing={2} onSubmit={form.handleSubmit((value) => mutation.mutate(value))}>
      <TextField required label="Организация" {...form.register('organizationName')} error={Boolean(form.formState.errors.organizationName)} helperText={form.formState.errors.organizationName?.message} />
      <TextField required label="БИН / ИИН" {...form.register('bin')} error={Boolean(form.formState.errors.bin)} helperText={form.formState.errors.bin?.message} />
      <TextField required label="ФИО контактного лица" {...form.register('contactName')} error={Boolean(form.formState.errors.contactName)} helperText={form.formState.errors.contactName?.message} />
      <TextField required label="Телефон" {...form.register('phone')} error={Boolean(form.formState.errors.phone)} helperText={form.formState.errors.phone?.message} />
      <TextField required label="Email владельца" {...form.register('email')} error={Boolean(form.formState.errors.email)} helperText={form.formState.errors.email?.message || 'На этот адрес администрация сможет связаться с владельцем'} />
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
