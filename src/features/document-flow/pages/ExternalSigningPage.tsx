import { useEffect, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Container, Dialog, DialogActions, DialogContent, DialogTitle, Paper, Stack, TextField, Typography } from '@mui/material';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { publicDocumentFlowApi } from '../api/documentFlowApi';
import { documentFlowKeys } from '../api/documentFlowKeys';
import BackendContractBlocker from '../components/BackendContractBlocker';
import { mapDocumentFlowError } from '../utils/apiErrorMapper';

export default function ExternalSigningPage() {
  const token = useParams().token || '';
  const [fileUrl, setFileUrl] = useState('');
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');
  const invitation = useQuery({
    queryKey: documentFlowKeys.publicSigning(token),
    queryFn: ({ signal }) => publicDocumentFlowApi.invitation(token, signal),
    enabled: Boolean(token),
    retry: false,
  });
  const file = useQuery({
    queryKey: [...documentFlowKeys.publicSigning(token), 'file'],
    queryFn: ({ signal }) => publicDocumentFlowApi.file(token, signal),
    enabled: invitation.isSuccess && ['AVAILABLE', 'VIEWED'].includes(invitation.data.status),
  });
  const challenge = useQuery({
    queryKey: [...documentFlowKeys.publicSigning(token), 'challenge'],
    queryFn: ({ signal }) => publicDocumentFlowApi.challenge(token, signal),
    enabled: invitation.isSuccess && ['AVAILABLE', 'VIEWED'].includes(invitation.data.status),
    retry: false,
  });
  useEffect(() => {
    if (!file.data) return;
    if (!(file.data.data instanceof Blob) || file.data.data.size === 0 || file.data.data.type.includes('json')) return;
    const url = URL.createObjectURL(file.data.data);
    setFileUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file.data]);
  const reject = useMutation({
    mutationFn: () => {
      if (reason.trim().length < 5 || reason.trim().length > 1000) throw new Error('Причина должна содержать от 5 до 1000 символов.');
      return publicDocumentFlowApi.reject(token, reason.trim());
    },
    onSuccess: () => { setRejectOpen(false); setReason(''); void invitation.refetch(); },
  });
  if (invitation.isLoading) return <Box minHeight="100vh" display="grid" sx={{ placeItems: 'center' }}><CircularProgress /></Box>;
  if (invitation.isError || !invitation.data) {
    return <Container maxWidth="sm" sx={{ py: 10 }}><Alert severity="error">Приглашение недействительно или срок его действия истёк.</Alert></Container>;
  }
  const data = invitation.data;
  const terminal = ['SIGNED', 'REJECTED', 'EXPIRED'].includes(data.status);
  return (
    <Container maxWidth="lg" sx={{ py: 5 }}>
      <Stack spacing={3}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h4" fontWeight={800}>{data.documentTitle}</Typography>
          <Typography>Статус: {data.status}</Typography>
          <Typography>Обязательная подпись: {data.required ? 'Да' : 'Нет'}</Typography>
          <Typography>Приглашение до: {data.invitationExpiresAt || '—'}</Typography>
          <Typography>Подписать до: {data.signingDeadline || '—'}</Typography>
        </Paper>
        {fileUrl && <Box component="iframe" title="Документ для внешнего подписания" src={fileUrl} width="100%" height="650px" border={0} />}
        {!terminal && <Stack direction="row" gap={2}>
          <Button color="error" onClick={() => setRejectOpen(true)}>Отклонить</Button>
        </Stack>}
        {!terminal && <BackendContractBlocker title="Подписание ожидает проверку challenge DTO" reason={challenge.isError ? 'Backend challenge недоступен. Документ можно просмотреть или отклонить.' : 'Challenge получен, но без Java DTO проверки CMS нельзя безопасно определить точные подписываемые байты.'} technicalCode="DF_PUBLIC_SIGN_CHALLENGE_UNVERIFIED" endpoint={`/api/public/document-flow/signing/{token}/challenge`} publicAudience />}
      </Stack>
      <Dialog open={rejectOpen} onClose={() => !reject.isPending && setRejectOpen(false)} fullWidth><DialogTitle>Отклонить документ</DialogTitle><DialogContent><TextField fullWidth multiline minRows={3} inputProps={{ maxLength: 1000 }} label="Причина" value={reason} onChange={(event) => setReason(event.target.value)} error={reason.length > 0 && reason.trim().length < 5} helperText={`${reason.trim().length}/1000, минимум 5 символов`} sx={{ mt: 1 }} />{reject.isError && <Alert severity="error">{mapDocumentFlowError(reject.error).message}</Alert>}</DialogContent><DialogActions><Button disabled={reject.isPending} onClick={() => setRejectOpen(false)}>Отмена</Button><Button color="error" disabled={reason.trim().length < 5 || reason.trim().length > 1000 || reject.isPending} onClick={() => reject.mutate()}>Отклонить</Button></DialogActions></Dialog>
    </Container>
  );
}
