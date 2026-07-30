import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Alert, Box, Button, Paper, Stack, Typography } from '@mui/material';
import { reportFrontendError } from '../observability/errorMonitoring';

type Props = {
  children: ReactNode;
  boundary?: string;
  requestId?: string;
  onSaveSafeDraft?: () => void;
};

type State = { error?: Error };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = {};

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    reportFrontendError({
      boundary: this.props.boundary || 'app',
      errorName: error.name || 'Error',
      requestId: this.props.requestId,
    });
  }

  private copyRequestId = async () => {
    if (this.props.requestId) await navigator.clipboard.writeText(this.props.requestId);
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2, bgcolor: 'background.default' }}>
        <Paper variant="outlined" sx={{ p: 4, maxWidth: 640 }}>
          <Stack spacing={2}>
            <Typography variant="h4" fontWeight={900}>Не удалось открыть раздел</Typography>
            <Alert severity="error">Интерфейс остановлен, чтобы не потерять или не перезаписать данные.</Alert>
            {this.props.requestId && <Typography variant="caption">Request ID: {this.props.requestId}</Typography>}
            <Stack direction="row" gap={1} flexWrap="wrap">
              <Button variant="contained" onClick={() => window.location.reload()}>Обновить страницу</Button>
              <Button onClick={() => window.location.assign('/documents')}>Вернуться к документам</Button>
              {this.props.requestId && <Button onClick={() => void this.copyRequestId()}>Скопировать Request ID</Button>}
              {this.props.onSaveSafeDraft && <Button onClick={this.props.onSaveSafeDraft}>Сохранить безопасный черновик</Button>}
            </Stack>
          </Stack>
        </Paper>
      </Box>
    );
  }
}

export const RouteErrorBoundary = ({ children }: { children: ReactNode }) =>
  <AppErrorBoundary boundary="route">{children}</AppErrorBoundary>;

export const DocumentEditorErrorBoundary = ({ children, onSaveSafeDraft }: { children: ReactNode; onSaveSafeDraft?: () => void }) =>
  <AppErrorBoundary boundary="document-editor" onSaveSafeDraft={onSaveSafeDraft}>{children}</AppErrorBoundary>;

export const SigningErrorBoundary = ({ children }: { children: ReactNode }) =>
  <AppErrorBoundary boundary="signing">{children}</AppErrorBoundary>;
