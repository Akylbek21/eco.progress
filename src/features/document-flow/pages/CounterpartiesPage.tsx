import { useState } from 'react';
import {
  Alert, Button, Card, CardContent, Dialog, DialogActions, DialogContent, DialogTitle,
  Grid, Stack, TextField, Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { documentFlowApi } from '../api/documentFlowApi';
import { documentFlowKeys } from '../api/documentFlowKeys';
import { canMutate } from '../model/access';
import { useDocumentFlowContext } from '../components/DocumentFlowGate';

const empty = { bin: '', name: '', directorName: '', address: '', email: '', phone: '' };

export default function CounterpartiesPage() {
  const access = useDocumentFlowContext();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const query = useQuery({
    queryKey: documentFlowKeys.counterparties({ page: 0, size: 100 }),
    queryFn: ({ signal }) => documentFlowApi.counterparties(0, 100, undefined, signal),
  });
  const create = useMutation({
    mutationFn: () => documentFlowApi.createCounterparty({ ...form, linkedOrganizationId: null }),
    onSuccess: async () => {
      setOpen(false);
      setForm(empty);
      await queryClient.invalidateQueries({ queryKey: documentFlowKeys.counterparties({ page: 0, size: 100 }) });
    },
  });
  const archive = useMutation({
    mutationFn: (id: number) => documentFlowApi.archiveCounterparty(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: documentFlowKeys.all }),
  });
  const allowed = canMutate(access, 'MANAGE_COUNTERPARTIES');
  return (
    <Stack spacing={3}>
      <Stack direction="row" justifyContent="space-between"><Typography variant="h4" fontWeight={800}>Контрагенты</Typography>{allowed && <Button variant="contained" onClick={() => setOpen(true)}>Добавить</Button>}</Stack>
      <Alert severity="info">Текущий backend list endpoint не принимает поиск по BIN/названию. Client-side фильтрация одной страницы не используется.</Alert>
      {query.isError && <Alert severity="error">{query.error.message}</Alert>}
      <Grid container spacing={2}>{(query.data?.items || []).map((item) => <Grid size={{ xs: 12, md: 6 }} key={item.id}><Card><CardContent><Typography variant="h6">{item.name}</Typography><Typography>БИН: {item.bin}</Typography><Typography color="text.secondary">{item.email} {item.phone}</Typography>{allowed && item.status !== 'ARCHIVED' && <Button color="warning" onClick={() => archive.mutate(item.id)}>Архивировать контрагента</Button>}</CardContent></Card></Grid>)}</Grid>
      <Dialog open={open} onClose={() => !create.isPending && setOpen(false)} fullWidth>
        <DialogTitle>Новый контрагент</DialogTitle>
        <DialogContent><Stack spacing={2} mt={1}>{Object.keys(empty).map((key) => <TextField key={key} label={{ bin: 'БИН', name: 'Название', directorName: 'Руководитель', address: 'Адрес', email: 'Email', phone: 'Телефон' }[key]} value={form[key as keyof typeof form]} onChange={(event) => setForm((value) => ({ ...value, [key]: event.target.value }))} />)}{create.isError && <Alert severity="error">{create.error.message}</Alert>}</Stack></DialogContent>
        <DialogActions><Button onClick={() => setOpen(false)}>Отмена</Button><Button variant="contained" disabled={create.isPending || !/^\d{12}$/.test(form.bin) || !form.name.trim()} onClick={() => create.mutate()}>Создать</Button></DialogActions>
      </Dialog>
    </Stack>
  );
}
