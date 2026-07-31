import type { PekAvailableAction, PekAvailableActionCode } from '../api/pekContracts';

const priority: PekAvailableActionCode[] = [
  'SUBMIT_REVIEW', 'RETURN', 'APPROVE', 'ACTIVATE', 'ARCHIVE', 'CLONE', 'EDIT',
];

export const primaryPekAction = (actions: PekAvailableAction[]) =>
  [...actions].sort((left, right) => {
    if (left.enabled !== right.enabled) return left.enabled ? -1 : 1;
    return priority.indexOf(left.code) - priority.indexOf(right.code);
  })[0];

export const pekAction = (actions: PekAvailableAction[], code: PekAvailableActionCode) =>
  actions.find((item) => item.code === code);
