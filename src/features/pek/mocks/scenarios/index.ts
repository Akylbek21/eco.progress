export const pekMockScenarios = [
  'default', 'empty', 'forbidden', 'not-found', 'server-error', 'version-conflict',
  'duplicate-report', 'collection-warning', 'collection-failed', 'validation-failed',
  'review', 'returned', 'approved', 'signature-pending', 'partial-signature',
  'signed', 'submission-accepted', 'submission-rejected',
] as const;

export type PekMockScenario = typeof pekMockScenarios[number];
