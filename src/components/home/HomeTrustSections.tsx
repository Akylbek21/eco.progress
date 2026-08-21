import QueryRuntime from '../../runtime/QueryRuntime';
import { DocumentsSection, TrustSection } from '../TrustBlocks';

export default function HomeTrustSections() {
  return <QueryRuntime><TrustSection /><DocumentsSection /></QueryRuntime>;
}
