import type { ProtocolTemplateId } from '../../../types/protocols';

export type ProtocolCreationRequirementStatus =
  | 'DUE'
  | 'OVERDUE'
  | 'COMPLETED'
  | 'NOT_DUE'
  | 'CONFIGURATION_REQUIRED';

export type ProtocolCreationIndicator = {
  id: string | number;
  name: string;
  unit?: string;
  normativeLabel?: string;
};

export type ProtocolCreationRequirement = {
  id: string;
  status: ProtocolCreationRequirementStatus;
  title: string;
  subtitle?: string;
  frequency?: string;
  planCount: number;
  completedCount: number;
  missingCount: number;
  canCreate: boolean;
  companyId: string | number;
  objectId: string | number;
  pekProgramId: string | number;
  pekMonitoringId: string | number;
  pekControlItemId: string | number;
  monitoringPointId: string | number | null;
  monitoringPointName?: string;
  protocolTemplateId: ProtocolTemplateId | string | number | null;
  protocolTemplateName?: string;
  laboratoryName?: string;
  existingDraftProtocolId?: string | number;
  indicators: ProtocolCreationIndicator[];
};

export type ProtocolCreationContext = {
  hasActiveProgram: boolean;
  company: { id: string | number; name: string };
  object: { id: string | number; name: string };
  program?: { id: string | number; number?: string; name?: string };
  period?: { label?: string; year?: number; quarter?: number; startDate?: string; endDate?: string };
  requirements: ProtocolCreationRequirement[];
};

export type ProtocolCreationContextParams = {
  companyId: string;
  objectId: string;
  date: string;
};

export type CreateProtocolFromPekRequest = Pick<ProtocolCreationRequirement,
  | 'companyId'
  | 'objectId'
  | 'pekProgramId'
  | 'pekMonitoringId'
  | 'pekControlItemId'
  | 'monitoringPointId'
  | 'protocolTemplateId'
>;
