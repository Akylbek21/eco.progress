import { useRef, useState } from 'react';
import { AttachFile, CloudUpload, Close } from '@mui/icons-material';
import { Alert, Box, Button, IconButton, LinearProgress, Paper, Stack, Typography } from '@mui/material';
import type { DocumentTypeConfig } from '../model/types';
import { validateDocumentFile } from '../model/access';

const sizeLabel = (size: number) => size < 1024 * 1024
  ? `${Math.ceil(size / 1024)} КБ` : `${(size / 1024 / 1024).toFixed(1)} МБ`;

export default function DocumentFileUploader({
  config, file, onChange, progress, disabled = false,
}: {
  config?: DocumentTypeConfig;
  file: File | null;
  onChange: (file: File | null) => void;
  progress?: number | null;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const error = file && config ? validateDocumentFile(file, config) : null;
  const choose = (next?: File) => next && onChange(next);
  return (
    <Stack spacing={1.5}>
      <Paper
        variant="outlined"
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => { event.preventDefault(); setDragging(false); choose(event.dataTransfer.files[0]); }}
        sx={{ p: 3, textAlign: 'center', borderStyle: 'dashed', borderColor: dragging ? 'primary.main' : 'divider', bgcolor: dragging ? 'action.hover' : 'background.paper' }}
      >
        <CloudUpload color="primary" sx={{ fontSize: 42 }} />
        <Typography fontWeight={700}>Перетащите основной файл сюда</Typography>
        <Typography variant="body2" color="text.secondary" mb={1}>или выберите его на компьютере</Typography>
        <Button startIcon={<AttachFile />} variant="outlined" disabled={disabled} onClick={() => input.current?.click()}>Выбрать файл</Button>
        <input ref={input} hidden type="file" accept={config?.allowedMimeTypes.join(',')} onChange={(event) => choose(event.target.files?.[0])} />
      </Paper>
      {file && <Paper variant="outlined" sx={{ p: 1.5 }}><Stack direction="row" alignItems="center" gap={1}>
        <Box flex={1}><Typography fontWeight={700}>{file.name}</Typography><Typography variant="body2" color="text.secondary">{sizeLabel(file.size)} · {file.type || 'тип не определён'}</Typography></Box>
        <IconButton aria-label="Удалить файл" disabled={disabled} onClick={() => onChange(null)}><Close /></IconButton>
      </Stack></Paper>}
      {progress !== undefined && <LinearProgress variant={progress == null ? 'indeterminate' : 'determinate'} value={progress ?? 0} />}
      {error && <Alert severity="error">{error}</Alert>}
      {config && <Typography variant="caption" color="text.secondary">Допустимые типы: {config.allowedMimeTypes.join(', ')}. До {sizeLabel(config.maxSizeBytes)}.</Typography>}
    </Stack>
  );
}
