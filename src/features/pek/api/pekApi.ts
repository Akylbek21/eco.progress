/**
 * Canonical PEK API entry point.
 *
 * Keep the `pekService` export during migration so existing screens do not
 * create a second endpoint implementation.
 */
export { pekService as pekApi, pekService } from './pekService';
export type { PekService } from './pekService';
