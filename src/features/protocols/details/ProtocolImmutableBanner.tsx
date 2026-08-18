import type { Protocol } from '../../../types/protocols';

const immutableStatuses = new Set(['SIGNED', 'PUBLISHED', 'REPLACED', 'CANCELLED', 'ARCHIVED']);

export const isProtocolImmutable = (protocol: Protocol) =>
  immutableStatuses.has(String(protocol.status).toUpperCase()) || Boolean(protocol.publishedAt || protocol.publishedToClientAt);

const ProtocolImmutableBanner = ({ protocol }: { protocol: Protocol }) =>
  isProtocolImmutable(protocol) ? (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
      Эта версия протокола зафиксирована и недоступна для изменения.
    </section>
  ) : null;

export default ProtocolImmutableBanner;
