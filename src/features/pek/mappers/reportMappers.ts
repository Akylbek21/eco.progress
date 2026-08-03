import type {
  PekCreationContext,
  PekReportCreateRequest,
  PekReportCreationParams,
  PekReportStatus,
} from '../api/pekContracts';

export const mapReportCreateRequest = (
  params: PekReportCreationParams,
  programId: number,
  collectImmediately: boolean,
  responsibleUserId?: number,
): PekReportCreateRequest => ({
  companyId: params.companyId,
  objectId: params.objectId,
  periodType: params.periodType,
  year: params.year,
  ...(params.periodType === 'QUARTER' ? { quarter: params.quarter } : {}),
  programId,
  collectImmediately,
  ...(responsibleUserId ? { responsibleUserId } : {}),
});

export const getCreationBlockState = (context?: PekCreationContext) => ({
  blocked: !context
    || context.blockingReasons.length > 0
    || Boolean(context.duplicateReportId)
    || context.programs.length === 0,
  duplicateReportId: context?.duplicateReportId ?? null,
  blockingReasons: context?.blockingReasons ?? [],
});

export type PekReportWorkflowAction = 'COLLECT' | 'SUBMIT_REVIEW' | 'APPROVE' | 'ARCHIVE';

/**
 * TODO: удалить после добавления availableActions в ReportResponse.
 * Mapper intentionally contains only endpoints implemented by the current backend.
 */
export const getReportWorkflowActions = (status: PekReportStatus | string): PekReportWorkflowAction[] => {
  switch (status) {
    case 'DRAFT':
      return ['COLLECT'];
    case 'COLLECTING':
      return ['COLLECT', 'SUBMIT_REVIEW'];
    case 'READY_FOR_REVIEW':
      return ['APPROVE'];
    case 'APPROVED':
      return ['ARCHIVE'];
    default:
      return [];
  }
};
