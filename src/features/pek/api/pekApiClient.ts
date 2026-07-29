import api from '../../../services/api';

/**
 * The only transport used by PEK. MSW intercepts this Axios traffic in
 * development/tests, so feature components remain transport-agnostic.
 */
export const pekApiClient = api;
