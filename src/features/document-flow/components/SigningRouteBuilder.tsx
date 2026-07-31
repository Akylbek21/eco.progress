import { Add, ArrowDownward, ArrowUpward, Delete } from '@mui/icons-material';
import { Alert, Button, Card, CardContent, FormControl, IconButton, InputLabel, MenuItem, Select, Stack, TextField, Typography } from '@mui/material';
import type { AccessContext, SignerType, SigningRouteRequest, SigningRouteType } from '../model/types';
import { hasFeature, validateRequiredCount } from '../model/access';

const emptyAssignment = () => ({ signerType: 'ORGANIZATION_MEMBER' as SignerType, signerFullName: '', email: '', required: true });

export default function SigningRouteBuilder({
  access,
  value,
  onChange,
}: {
  access: AccessContext;
  value: SigningRouteRequest;
  onChange: (value: SigningRouteRequest) => void;
}) {
  const setStep = (index: number, patch: Partial<SigningRouteRequest['steps'][number]>) => {
    const steps = value.steps.map((step, stepIndex) => stepIndex === index ? { ...step, ...patch } : step);
    onChange({ ...value, steps });
  };
  const move = (index: number, offset: number) => {
    const target = index + offset;
    if (target < 0 || target >= value.steps.length) return;
    const steps = [...value.steps];
    [steps[index], steps[target]] = [steps[target], steps[index]];
    onChange({ ...value, steps });
  };
  const availableTypes: SigningRouteType[] = [
    ...(hasFeature(access, 'SEQUENTIAL_SIGNING') ? ['SEQUENTIAL' as const] : []),
    ...(hasFeature(access, 'PARALLEL_SIGNING') ? ['PARALLEL' as const] : []),
    ...(hasFeature(access, 'MIXED_SIGNING') ? ['MIXED' as const] : []),
  ];
  return (
    <Stack spacing={2}>
      <FormControl fullWidth><InputLabel>Тип маршрута</InputLabel>
        <Select label="Тип маршрута" value={value.routeType} onChange={(event) => onChange({ ...value, routeType: event.target.value as SigningRouteType })}>
          {availableTypes.map((type) => <MenuItem value={type} key={type}>{type}</MenuItem>)}
        </Select>
      </FormControl>
      {!availableTypes.length && <Alert severity="warning">Тариф не разрешает маршруты подписания.</Alert>}
      {value.steps.map((step, stepIndex) => (
        <Card
          key={stepIndex}
          draggable
          onDragStart={(event) => event.dataTransfer.setData('text/step-index', String(stepIndex))}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            const from = Number(event.dataTransfer.getData('text/step-index'));
            if (Number.isInteger(from)) move(from, stepIndex - from);
          }}
        >
          <CardContent>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography fontWeight={800}>Шаг {stepIndex + 1}</Typography>
              <Stack direction="row"><IconButton onClick={() => move(stepIndex, -1)}><ArrowUpward /></IconButton><IconButton onClick={() => move(stepIndex, 1)}><ArrowDownward /></IconButton><IconButton onClick={() => onChange({ ...value, steps: value.steps.filter((_, index) => index !== stepIndex) })}><Delete /></IconButton></Stack>
            </Stack>
            <TextField
              type="number"
              label="Требуемое количество подписей"
              value={step.requiredCount}
              error={!validateRequiredCount(step.requiredCount, step.assignments.length)}
              helperText={!validateRequiredCount(step.requiredCount, step.assignments.length) ? 'От 1 до количества подписантов' : ''}
              onChange={(event) => setStep(stepIndex, { requiredCount: Number(event.target.value) })}
              sx={{ mt: 2 }}
            />
            <Stack spacing={2} mt={2}>
              {step.assignments.map((assignment, assignmentIndex) => (
                <Stack direction={{ xs: 'column', md: 'row' }} gap={1} key={assignmentIndex}>
                  <Select
                    value={assignment.signerType}
                    onChange={(event) => {
                      const assignments = step.assignments.map((item, index) => index === assignmentIndex ? { ...item, signerType: event.target.value as SignerType } : item);
                      setStep(stepIndex, { assignments });
                    }}
                  >
                    <MenuItem value="ORGANIZATION_MEMBER">Сотрудник</MenuItem>
                    <MenuItem value="COUNTERPARTY_REPRESENTATIVE">Представитель</MenuItem>
                    {hasFeature(access, 'EXTERNAL_SIGNING') && <MenuItem value="EXTERNAL">Внешний</MenuItem>}
                  </Select>
                  <TextField label="ФИО" value={assignment.signerFullName || ''} onChange={(event) => {
                    const assignments = step.assignments.map((item, index) => index === assignmentIndex ? { ...item, signerFullName: event.target.value } : item);
                    setStep(stepIndex, { assignments });
                  }} />
                  {assignment.signerType === 'ORGANIZATION_MEMBER'
                    ? <TextField type="number" label="User ID" value={assignment.userId || ''} onChange={(event) => {
                      const assignments = step.assignments.map((item, index) => index === assignmentIndex ? { ...item, userId: Number(event.target.value) || undefined } : item);
                      setStep(stepIndex, { assignments });
                    }} />
                    : <TextField type="email" label="Email" value={assignment.email || ''} onChange={(event) => {
                      const assignments = step.assignments.map((item, index) => index === assignmentIndex ? { ...item, email: event.target.value } : item);
                      setStep(stepIndex, { assignments });
                    }} />}
                  <IconButton onClick={() => setStep(stepIndex, { assignments: step.assignments.filter((_, index) => index !== assignmentIndex) })}><Delete /></IconButton>
                </Stack>
              ))}
              {hasFeature(access, 'MULTI_SIGNING') && <Button startIcon={<Add />} onClick={() => setStep(stepIndex, { assignments: [...step.assignments, emptyAssignment()] })}>Добавить подписанта</Button>}
            </Stack>
          </CardContent>
        </Card>
      ))}
      <Button startIcon={<Add />} variant="outlined" onClick={() => onChange({ ...value, steps: [...value.steps, { requiredCount: 1, assignments: [emptyAssignment()] }] })}>Добавить шаг</Button>
    </Stack>
  );
}
