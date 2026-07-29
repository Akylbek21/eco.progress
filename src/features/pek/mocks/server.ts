import { setupServer } from 'msw/node';
import { pekHandlers } from './handlers';

export const pekMockServer = setupServer(...pekHandlers);
