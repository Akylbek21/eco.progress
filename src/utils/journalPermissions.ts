import type { User } from '../types';
import type { JournalEntry } from '../types/labJournal';

const viewRoles = new Set(['ADMIN', 'DIRECTOR', 'HEAD', 'LABORATORY']);
const archiveRoles = new Set(['ADMIN', 'DIRECTOR', 'HEAD']);
const role = (user?: User | null) => user?.role || '';

export const canViewJournals = (user?: User | null) => viewRoles.has(role(user));
export const canCreateJournalEntry = (user?: User | null, laboratoryId?: number) => viewRoles.has(role(user)) && Boolean(laboratoryId);
export const canEditJournalEntry = (user?: User | null, entry?: JournalEntry | null) => viewRoles.has(role(user)) && Boolean(entry) && !entry?.archived;
export const canArchiveJournalEntry = (user?: User | null, entry?: JournalEntry | null) => archiveRoles.has(role(user)) && Boolean(entry) && !entry?.archived;
export const canRestoreJournalEntry = (user?: User | null, entry?: JournalEntry | null) => archiveRoles.has(role(user)) && Boolean(entry?.archived);
export const canExportJournal = (user?: User | null) => viewRoles.has(role(user));

