import { z } from 'zod';

const namedRef = z.object({
  id: z.number(),
  name: z.string(),
}).passthrough();

export const pekAvailableActionSchema = z.object({
  code: z.string(),
  label: z.string(),
  enabled: z.boolean(),
  disabledReason: z.string().nullable().optional(),
  confirmationRequired: z.boolean().optional(),
  requiresComment: z.boolean().optional(),
}).passthrough();

const programStatus = z.enum(['DRAFT', 'UNDER_REVIEW', 'RETURNED', 'APPROVED', 'ACTIVE', 'ARCHIVED']);
const reportStatus = z.enum([
  'DRAFT', 'COLLECTING', 'REQUIRES_CORRECTION', 'READY_FOR_REVIEW', 'UNDER_REVIEW',
  'RETURNED', 'READY_FOR_APPROVAL', 'APPROVED', 'READY_FOR_SIGNING',
  'PARTIALLY_SIGNED', 'SIGNED', 'SUBMITTED', 'ACCEPTED', 'REJECTED', 'ARCHIVED',
]);

export const pekProgramSchema = z.object({
  id: z.number(),
  number: z.string(),
  name: z.string(),
  version: z.number(),
  status: programStatus,
  company: namedRef.nullish(),
  object: namedRef.nullish(),
  validFrom: z.string(),
  validUntil: z.string(),
  responsible: namedRef.nullish(),
  readinessPercent: z.number().nullish(),
  availableActions: z.array(pekAvailableActionSchema),
  readOnly: z.boolean(),
}).passthrough();

const sectionSchema = z.object({
  code: z.string(),
  label: z.string(),
  applicable: z.boolean(),
  readinessPercent: z.number(),
  errorCount: z.number(),
  warningCount: z.number(),
  completed: z.boolean(),
}).passthrough();

export const pekReportSchema = z.object({
  id: z.number(),
  number: z.string(),
  revision: z.number(),
  version: z.number(),
  status: reportStatus,
  periodType: z.enum(['QUARTER', 'YEAR']),
  year: z.number(),
  periodStart: z.string(),
  periodEnd: z.string(),
  company: namedRef.nullish(),
  object: namedRef.nullish(),
  program: namedRef.nullish(),
  readinessPercent: z.number(),
  valid: z.boolean(),
  blockingIssueCount: z.number(),
  warningCount: z.number(),
  exceedanceCount: z.number(),
  sections: z.array(sectionSchema),
  availableActions: z.array(pekAvailableActionSchema),
  readOnly: z.boolean(),
  validationActual: z.boolean(),
  blockingReasons: z.array(z.string()),
}).passthrough();

export const pekCreationContextSchema = z.object({
  company: namedRef.nullish(),
  object: namedRef.nullish(),
  periodStart: z.string(),
  periodEnd: z.string(),
  programs: z.array(pekProgramSchema),
  selectedProgramId: z.number().nullish(),
  duplicateReportId: z.number().nullish(),
  warnings: z.array(z.string()),
  blockingReasons: z.array(z.string()),
}).passthrough();

export const pekCollectionRunSchema = z.object({
  id: z.number(),
  status: z.enum([
    'CREATED', 'RUNNING', 'COMPLETED', 'COMPLETED_WITH_WARNINGS', 'FAILED', 'CANCELLED',
  ]),
  progressPercent: z.number().min(0).max(100),
  processedRows: z.number(),
  foundIssues: z.number(),
}).passthrough();

export const parsePekResponse = <T>(schema: z.ZodType<T>, value: unknown, resource: string): T => {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  throw new Error(`PEK_API_CONTRACT_MISMATCH: ${resource}: ${result.error.issues.map((issue) => issue.path.join('.')).join(', ')}`);
};

export const validatePekResponse = <T>(schema: z.ZodType, value: T, resource: string): T => {
  const result = schema.safeParse(value);
  if (result.success) return value;
  throw new Error(`PEK_API_CONTRACT_MISMATCH: ${resource}: ${result.error.issues.map((issue) => issue.path.join('.')).join(', ')}`);
};
