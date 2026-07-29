export const statusLabel = (status: string) => ({
  DRAFT: 'Черновик',
  SENT: 'Отправлен',
  PARTIALLY_SIGNED: 'Частично подписан',
  SIGNED: 'Подписан',
  REJECTED: 'Отклонён',
  REVOKED: 'Отозван',
  OVERDUE: 'Просрочен',
  ARCHIVED: 'В архиве',
}[status] || status);

export const signaturePercent = (signed?: number, total?: number) =>
  total && total > 0 ? Math.min(100, Math.max(0, Math.round(((signed || 0) / total) * 100))) : 0;

export const canPerform = (availableActions: string[] | undefined, action: string) =>
  Boolean(availableActions?.includes(action));

export const validateSigningRoute = (steps: Array<{ signerIds: string[] }>) => {
  if (!steps.length) return ['Маршрут не содержит шагов'];
  const issues: string[] = [];
  const signers = new Set<string>();
  steps.forEach((step, index) => {
    if (!step.signerIds.length) issues.push(`Шаг ${index + 1} не содержит подписантов`);
    step.signerIds.forEach((id) => {
      if (signers.has(id)) issues.push(`Подписант ${id} добавлен повторно`);
      signers.add(id);
    });
  });
  return issues;
};
