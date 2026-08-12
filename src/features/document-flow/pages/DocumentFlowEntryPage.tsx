import { Navigate } from 'react-router-dom';

/** Staff already has an authenticated CRM session; never ask them to sign in again. */
export default function DocumentFlowEntryPage() {
  return <Navigate to="/document-flow/documents" replace />;
}
