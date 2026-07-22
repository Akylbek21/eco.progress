import type { User } from '../types';
import type { LabJournalEntry } from '../types/labJournal';

const readRoles = new Set(['ADMIN', 'DIRECTOR', 'HEAD', 'LABORATORY']);
const writeRoles = new Set(['ADMIN', 'LABORATORY']);
const role = (user?: User | null) => user?.role || '';

export const canReadLabJournals = (user?: User | null) => readRoles.has(role(user));
export const canCreateLabJournalEntry = (user?: User | null) => writeRoles.has(role(user));
export const canEditLabJournalEntry = (user?: User | null, entry?: LabJournalEntry | null) => writeRoles.has(role(user)) && Boolean(entry);
export const canDeleteLabJournalEntry = (user?: User | null, entry?: LabJournalEntry | null) => writeRoles.has(role(user)) && Boolean(entry);
export const canExportLabJournals = (user?: User | null) => readRoles.has(role(user));

export const canViewJournals = canReadLabJournals;
export const canCreateJournalEntry = (user?: User | null, laboratoryId?: number) => canCreateLabJournalEntry(user) && Boolean(laboratoryId);
export const canEditJournalEntry = canEditLabJournalEntry;
export const canArchiveJournalEntry = canDeleteLabJournalEntry;
export const canRestoreJournalEntry = () => false;
export const canExportJournal = canExportLabJournals;
