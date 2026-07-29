import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography,
} from '@mui/material';
import { documentFlowAccessApi } from '../api/documentFlowApi';
import { getDocumentFlowError } from '../utils/errors';
import type { DocumentFlowPlan } from '../types';

const schema = z.object({
  organization: z.string().trim().min(2, 'Укажите организацию'),
  bin: z.string().regex(/^\d{12}$/, 'БИН должен содержать 12 цифр'),
  contactPerson: z.string().trim().min(2, 'Укажите контактное лицо'),
  phone: z.string().trim().min(7, 'Укажите телефон'),
  email: z.email('Укажите корректный email'),
  planCode: z.string().optional(),
  membersCount: z.number().int().min(1).max(100000),
  comment: z.string().max(1000).optional(),
});

type Values = z.infer<typeof schema>;

export const AccessRequestDialog = ({
  open,
  plans = [],
  selectedPlan,
  onClose,
}: {
  open: boolean;
  plans?: DocumentFlowPlan[];
  selectedPlan?: string;
  onClose: () => void;
}) => {
  const [result, setResult] = useState<{ requestId: string; status: string } | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { organization: '', bin: '', contactPerson: '', phone: '', email: '', planCode: selectedPlan || '', membersCount: 1, comment: '' },
  });
  const mutation = useMutation({
    mutationFn: (values: Values) => documentFlowAccessApi.request(values, crypto.randomUUID()),
    retry: false,
    onSuccess: setResult,
  });
  const error = mutation.isError ? getDocumentFlowError(mutation.error) : null;

  return (
    <Dialog open={open} onClose={mutation.isPending ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Заявка на подключение</DialogTitle>
      <DialogContent>
        {result ? (
          <Alert severity="success">
            <Typography fontWeight={800}>Заявка принята</Typography>
            <Typography variant="body2">Менеджер свяжется с вами. Номер заявки: {result.requestId}</Typography>
          </Alert>
        ) : (
          <Stack component="form" id="document-flow-access-form" onSubmit={form.handleSubmit((values) => mutation.mutate(values))} spacing={2} sx={{ pt: 1 }}>
            <TextField label="Организация" {...form.register('organization')} error={!!form.formState.errors.organization} helperText={form.formState.errors.organization?.message} />
            <TextField label="БИН" inputProps={{ inputMode: 'numeric', maxLength: 12 }} {...form.register('bin')} error={!!form.formState.errors.bin} helperText={form.formState.errors.bin?.message} />
            <TextField label="Контактное лицо" {...form.register('contactPerson')} error={!!form.formState.errors.contactPerson} helperText={form.formState.errors.contactPerson?.message} />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField fullWidth label="Телефон" {...form.register('phone')} error={!!form.formState.errors.phone} helperText={form.formState.errors.phone?.message} />
              <TextField fullWidth label="Email" {...form.register('email')} error={!!form.formState.errors.email} helperText={form.formState.errors.email?.message} />
            </Stack>
            <TextField select label="Тариф" defaultValue={selectedPlan || ''} {...form.register('planCode')}>
              <MenuItem value="">Подобрать с менеджером</MenuItem>
              {plans.filter((plan) => plan.active).map((plan) => <MenuItem key={plan.code} value={plan.code}>{plan.name}</MenuItem>)}
            </TextField>
            <TextField label="Количество сотрудников" type="number" {...form.register('membersCount', { valueAsNumber: true })} error={!!form.formState.errors.membersCount} helperText={form.formState.errors.membersCount?.message} />
            <TextField label="Комментарий" multiline minRows={3} {...form.register('comment')} />
            {error && <Alert severity="error">{error.message}</Alert>}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{result ? 'Закрыть' : 'Отмена'}</Button>
        {!result && <Button type="submit" form="document-flow-access-form" variant="contained" disabled={mutation.isPending}>{mutation.isPending ? 'Отправка…' : 'Отправить заявку'}</Button>}
      </DialogActions>
    </Dialog>
  );
};
