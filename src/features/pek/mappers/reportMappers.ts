import type { PekCreationContext, PekReportCreateRequest, PekReportCreationParams } from '../api/pekContracts';

export const mapReportCreateRequest = (
  params: PekReportCreationParams,
  programId: number,
  collectImmediately: boolean,
): PekReportCreateRequest => ({
  companyId: params.companyId,
  objectId: params.objectId,
  periodType: params.periodType,
  year: params.year,
  ...(params.periodType === 'QUARTER' ? { quarter: params.quarter } : {}),
  programId,
  collectImmediately,
});

export const getCreationBlockState = (context?: PekCreationContext) => ({
  blocked: !context
    || context.blockingReasons.length > 0
    || Boolean(context.duplicateReportId)
    || context.programs.length === 0,
  duplicateReportId: context?.duplicateReportId ?? null,
  blockingReasons: context?.blockingReasons ?? [],
});
