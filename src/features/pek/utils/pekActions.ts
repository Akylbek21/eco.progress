import type { PekAvailableAction, PekAvailableActionCode } from '../api/pekContracts';

const priority: PekAvailableActionCode[] = [
  'COLLECT', 'VALIDATE', 'SUBMIT_REVIEW', 'START_REVIEW', 'ACCEPT_REVIEW',
  'APPROVE', 'PREPARE_SIGNING', 'SIGN', 'REGISTER_SUBMISSION',
  'REGISTER_RESULT', 'CREATE_REVISION', 'ARCHIVE',
];
export const primaryPekAction = (actions: PekAvailableAction[]) =>
  [...actions].sort((a, b) => {
    const left = priority.indexOf(a.code);
    const right = priority.indexOf(b.code);
    return (left < 0 ? Number.MAX_SAFE_INTEGER : left) - (right < 0 ? Number.MAX_SAFE_INTEGER : right);
  })[0];
export const pekAction = (actions: PekAvailableAction[], code: PekAvailableActionCode) =>
  actions.find((item) => item.code === code);
