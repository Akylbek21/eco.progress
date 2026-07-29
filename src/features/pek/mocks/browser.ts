import { setupWorker } from 'msw/browser';
import { pekHandlers } from './handlers';

export const pekMockWorker = setupWorker(...pekHandlers);
