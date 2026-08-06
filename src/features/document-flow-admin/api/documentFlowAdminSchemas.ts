import { z } from 'zod';

const nullableString = z.string().nullable().optional().default(null);

export const accessGrantFormSchema = z.object({
  organizationId: z.number().int().positive(),
  planCode: z.string().trim().min(1),
  startsAt: z.string().trim().min(1),
  expiresAt: z.string().nullable(),
  graceEndsAt: z.string().nullable(),
  paymentMode: z.literal('ADMIN_GRANT'),
  paymentReference: z.string().nullable(),
  reason: z.string().trim().min(5).max(1000),
  limits: z.record(z.string(), z.number().int().nonnegative()).optional(),
}).superRefine((value, context) => {
  if (value.planCode !== 'INTERNAL' && !value.expiresAt) {
    context.addIssue({ code: 'custom', path: ['expiresAt'], message: 'Для временного доступа укажите дату окончания.' });
  }
});

export const accessGrantRequestSchema = accessGrantFormSchema.transform((value) => ({
  ...value,
  limits: value.limits && Object.keys(value.limits).length ? value.limits : undefined,
}));

export const accessGrantResponseSchema = z.object({
  id: z.number().int().optional(),
  subscriptionId: z.number().int().optional(),
}).passthrough();

export const subscriptionResponseSchema = z.object({
  id: z.number().int(), organizationId: z.number().int(), planId: z.number().int(), status: z.string(),
  startsAt: z.string(), expiresAt: nullableString, trialEndsAt: nullableString, graceEndsAt: nullableString,
  paymentMode: z.string(), paymentReference: nullableString, suspensionReason: nullableString,
  createdBy: z.union([z.string(), z.number()]).nullable().optional().transform((value) => value == null ? null : String(value)),
  grantedBy: z.union([z.string(), z.number()]).nullable().optional(), createdAt: z.string(), updatedAt: z.string(),
  version: z.number().int().nullable().optional().default(null),
}).passthrough().transform((value) => ({
  ...value,
  createdBy: value.createdBy ?? (value.grantedBy == null ? null : String(value.grantedBy)),
}));

export const subscriptionsResponseSchema = z.array(subscriptionResponseSchema);

export const planResponseSchema = z.object({
  id: z.number().int(), code: z.string(), nameRu: z.string().optional(), name: z.string().optional(), active: z.boolean(),
  features: z.array(z.object({ code: z.string(), enabled: z.boolean(), limitValue: z.number().nullable().optional() }).passthrough()).optional().default([]),
}).passthrough().transform((value) => ({
  id: value.id, code: value.code, name: value.nameRu ?? value.name ?? value.code, active: value.active,
  limits: Object.fromEntries(value.features.filter((feature) => feature.enabled && feature.limitValue != null).map((feature) => [feature.code, feature.limitValue!])),
}));

export const plansResponseSchema = z.array(planResponseSchema);

