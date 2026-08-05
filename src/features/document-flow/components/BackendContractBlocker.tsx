import { Alert, AlertTitle, Box, Typography } from '@mui/material';

interface BackendContractBlockerProps {
  title: string;
  reason: string;
  technicalCode: string;
  endpoint?: string;
  status?: number;
  backendCode?: string;
  traceId?: string;
  missingField?: string;
  publicAudience?: boolean;
}

export default function BackendContractBlocker({
  title, reason, technicalCode, endpoint, status, backendCode, traceId, missingField, publicAudience = false,
}: BackendContractBlockerProps) {
  const showTechnical = import.meta.env.DEV && !publicAudience;
  return (
    <Alert severity="warning">
      <AlertTitle>{title}</AlertTitle>
      {reason}
      {showTechnical && <Box mt={1}>
        <Typography variant="caption" component="div">Код: {technicalCode}</Typography>
        {endpoint && <Typography variant="caption" component="div">Endpoint: {endpoint}</Typography>}
        {status !== undefined && <Typography variant="caption" component="div">HTTP: {status}</Typography>}
        {backendCode && <Typography variant="caption" component="div">Backend code: {backendCode}</Typography>}
        {traceId && <Typography variant="caption" component="div">Trace ID: {traceId}</Typography>}
        {missingField && <Typography variant="caption" component="div">Отсутствует: {missingField}</Typography>}
      </Box>}
    </Alert>
  );
}
