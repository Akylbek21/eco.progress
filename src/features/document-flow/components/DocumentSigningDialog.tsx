import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress, Stack, Typography } from '@mui/material';
import { createCmsSignatureWithNCALayer, type NCALayerSigningPhase } from '../../../services/ncalayer';
import { documentFlowSigningApi } from '../api/documentFlowApi';
import { documentFlowKeys } from '../api/documentFlowKeys';
import { getDocumentFlowError } from '../utils/errors';

const phaseLabel: Record<NCALayerSigningPhase, string> = {
  CONNECTING: 'Подключение к NCALayer…',
  SELECTING_CERTIFICATE: 'Выберите сертификат в NCALayer…',
  CREATING_SIGNATURE: 'Создание CMS-подписи…',
};

export const DocumentSigningDialog = ({ documentId, open, onClose }: { documentId: string; open: boolean; onClose: () => void }) => {
  const client = useQueryClient();
  const [phase, setPhase] = useState<NCALayerSigningPhase | null>(null);
  const mutation = useMutation({
    retry: false,
    mutationFn: async () => {
      const current = await documentFlowSigningApi.prepare(documentId);
      setPhase('CONNECTING');
      const cms = await createCmsSignatureWithNCALayer(current.contentBase64, setPhase);
      return documentFlowSigningApi.submit(documentId, {
        version: current.version,
        hash: current.hash,
        cms,
      }, crypto.randomUUID());
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: documentFlowKeys.document(documentId) });
      onClose();
    },
  });
  const error = mutation.isError ? getDocumentFlowError(mutation.error, 'Не удалось подписать документ.') : null;
  return (
    <Dialog open={open} onClose={mutation.isPending ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Подписать документ ЭЦП</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Alert severity="info">После нажатия backend повторно выдаст актуальные данные и хэш. Закрытый ключ и пароль остаются в NCALayer.</Alert>
          {mutation.isPending && <><LinearProgress /><Typography>{phase ? phaseLabel[phase] : 'Подготовка данных backend…'}</Typography></>}
          {error && <Alert severity="error">{error.message}{error.traceId ? ` Код обращения: ${error.traceId}` : ''}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions><Button disabled={mutation.isPending} onClick={onClose}>Отмена</Button><Button variant="contained" disabled={mutation.isPending} onClick={() => mutation.mutate()}>Подключить NCALayer и подписать</Button></DialogActions>
    </Dialog>
  );
};
