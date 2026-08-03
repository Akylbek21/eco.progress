import { useEffect, useState } from 'react';
import { Add, ArrowDownward, ArrowUpward, Delete } from '@mui/icons-material';
import {
  Alert, Autocomplete, Box, Button, Card, CardContent, FormControl, IconButton, InputLabel,
  MenuItem, Select, Stack, TextField, Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { documentFlowApi } from '../api/documentFlowApi';
import type { AccessContext, OrganizationSigner, SignerType, SigningAssignmentInput, SigningRouteRequest, SigningRouteType } from '../model/types';
import { hasFeature, validateRequiredCount } from '../model/access';

const emptyAssignment = (): SigningAssignmentInput => ({ signerType: 'ORGANIZATION_MEMBER', required: true });

function MemberPicker({ organizationId, value, excluded, onChange }: {
  organizationId?: number;
  value: SigningAssignmentInput;
  excluded: number[];
  onChange: (value: SigningAssignmentInput) => void;
}) {
  const [query, setQuery] = useState('');
  const signers = useQuery({
    queryKey: ['document-flow', 'signers', organizationId, query],
    queryFn: ({ signal }) => documentFlowApi.organizationSigners(organizationId!, query, signal),
    enabled: Boolean(organizationId) && query.trim().length >= 2,
    staleTime: 30_000,
  });
  const current: OrganizationSigner | null = value.userId ? {
    id: value.userId, fullName: value.signerFullName || '', position: null,
    email: value.email || null, active: true, organizationId: organizationId || 0,
  } : null;
  return <Autocomplete
    sx={{ minWidth: 280, flex: 1 }}
    value={current}
    options={(signers.data || []).filter((item) => item.active && item.organizationId === organizationId && !excluded.includes(item.id))}
    loading={signers.isFetching}
    filterOptions={(options) => options}
    getOptionLabel={(option) => option.fullName}
    isOptionEqualToValue={(option, selected) => option.id === selected.id}
    onInputChange={(_, next) => setQuery(next)}
    onChange={(_, signer) => onChange({ ...value, userId: signer?.id, signerFullName: signer?.fullName, email: signer?.email || undefined })}
    renderOption={(props, signer) => <li {...props} key={signer.id}><Stack><Typography>{signer.fullName}</Typography><Typography variant="caption" color="text.secondary">{[signer.position, signer.email].filter(Boolean).join(' · ')}</Typography></Stack></li>}
    renderInput={(params) => <TextField {...params} label="Сотрудник" helperText={organizationId ? 'Введите минимум 2 символа' : 'Организация не определена backend-контекстом'} />}
  />;
}

export default function SigningRouteBuilder({ access, organizationId, value, onChange }: {
  access: AccessContext;
  organizationId?: number;
  value: SigningRouteRequest;
  onChange: (value: SigningRouteRequest) => void;
}) {
  const [notice, setNotice] = useState('');
  const setStep = (index: number, patch: Partial<SigningRouteRequest['steps'][number]>) => {
    const steps = value.steps.map((step, stepIndex) => stepIndex === index ? { ...step, ...patch } : step);
    onChange({ ...value, steps });
  };
  const setAssignments = (stepIndex: number, assignments: SigningAssignmentInput[]) => {
    const current = value.steps[stepIndex];
    const requiredCount = Math.min(current.requiredCount, assignments.length);
    if (requiredCount !== current.requiredCount) setNotice('Количество обязательных подписей скорректировано после удаления подписанта.');
    setStep(stepIndex, { assignments, requiredCount: Math.max(assignments.length ? 1 : 0, requiredCount) });
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
  useEffect(() => { if (!availableTypes.includes(value.routeType) && availableTypes[0]) onChange({ ...value, routeType: availableTypes[0] }); }, [availableTypes.join('|')]);
  return (
    <Stack spacing={2}>
      {notice && <Alert severity="info" onClose={() => setNotice('')}>{notice}</Alert>}
      <FormControl fullWidth><InputLabel>Тип маршрута</InputLabel><Select label="Тип маршрута" value={value.routeType} onChange={(event) => onChange({ ...value, routeType: event.target.value as SigningRouteType })}>{availableTypes.map((type) => <MenuItem value={type} key={type}>{type === 'SEQUENTIAL' ? 'Последовательно' : type === 'PARALLEL' ? 'Параллельно' : 'Смешанный'}</MenuItem>)}</Select></FormControl>
      {!availableTypes.length && <Alert severity="warning">Тариф не разрешает маршруты подписания.</Alert>}
      {value.steps.map((step, stepIndex) => <Card key={stepIndex} variant="outlined"><CardContent>
        <Stack direction="row" alignItems="center" justifyContent="space-between"><Box><Typography fontWeight={800}>Шаг {stepIndex + 1}</Typography><Typography variant="caption" color="text.secondary">Подписанты шага получают задания параллельно</Typography></Box><Stack direction="row"><IconButton aria-label="Переместить вверх" disabled={stepIndex === 0} onClick={() => move(stepIndex, -1)}><ArrowUpward /></IconButton><IconButton aria-label="Переместить вниз" disabled={stepIndex === value.steps.length - 1} onClick={() => move(stepIndex, 1)}><ArrowDownward /></IconButton><IconButton aria-label="Удалить шаг" onClick={() => onChange({ ...value, steps: value.steps.filter((_, index) => index !== stepIndex) })}><Delete /></IconButton></Stack></Stack>
        <TextField select label="Обязательных подписей" value={step.requiredCount || ''} error={step.assignments.length > 0 && !validateRequiredCount(step.requiredCount, step.assignments.length)} sx={{ mt: 2, minWidth: 220 }} onChange={(event) => setStep(stepIndex, { requiredCount: Number(event.target.value) })}>{step.assignments.map((_, index) => <MenuItem key={index + 1} value={index + 1}>{index + 1}</MenuItem>)}</TextField>
        <Stack spacing={2} mt={2}>{step.assignments.map((assignment, assignmentIndex) => {
          const update = (next: SigningAssignmentInput) => setAssignments(stepIndex, step.assignments.map((item, index) => index === assignmentIndex ? next : item));
          return <Stack direction={{ xs: 'column', md: 'row' }} gap={1} alignItems={{ md: 'flex-start' }} key={assignmentIndex}>
            <Select value={assignment.signerType} onChange={(event) => update({ signerType: event.target.value as SignerType, required: true })}><MenuItem value="ORGANIZATION_MEMBER">Сотрудник</MenuItem>{hasFeature(access, 'EXTERNAL_SIGNING') && <MenuItem value="EXTERNAL">Внешний подписант</MenuItem>}</Select>
            {assignment.signerType === 'ORGANIZATION_MEMBER'
              ? <MemberPicker organizationId={organizationId} value={assignment} excluded={step.assignments.filter((_, index) => index !== assignmentIndex).flatMap((item) => item.userId ? [item.userId] : [])} onChange={update} />
              : <Stack direction={{ xs: 'column', md: 'row' }} gap={1} flex={1}><TextField required label="ФИО или название" value={assignment.signerFullName || ''} onChange={(event) => update({ ...assignment, signerFullName: event.target.value })} /><TextField required type="email" label="Email" value={assignment.email || ''} error={Boolean(assignment.email && !/^\S+@\S+\.\S+$/.test(assignment.email))} onChange={(event) => update({ ...assignment, email: event.target.value })} /><TextField label="ИИН/БИН" value={assignment.signerIin || ''} onChange={(event) => update({ ...assignment, signerIin: event.target.value })} /></Stack>}
            <IconButton aria-label="Удалить подписанта" onClick={() => setAssignments(stepIndex, step.assignments.filter((_, index) => index !== assignmentIndex))}><Delete /></IconButton>
          </Stack>;
        })}<Button startIcon={<Add />} onClick={() => setAssignments(stepIndex, [...step.assignments, emptyAssignment()])}>Добавить подписанта</Button></Stack>
      </CardContent></Card>)}
      <Button startIcon={<Add />} variant="outlined" onClick={() => onChange({ ...value, steps: [...value.steps, { requiredCount: 1, assignments: [emptyAssignment()] }] })}>Добавить шаг</Button>
      {value.steps.length > 0 && <Alert severity={value.steps.every((step) => validateRequiredCount(step.requiredCount, step.assignments.length)) ? 'success' : 'warning'}>{value.steps.map((step, index) => `Шаг ${index + 1}: ${step.assignments.map((item) => item.signerFullName || 'подписант не выбран').join(', ')} — требуется ${step.requiredCount}`).join(' · ')}</Alert>}
    </Stack>
  );
}
