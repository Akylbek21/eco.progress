import { CheckCircle2 } from 'lucide-react';
import Button from '../../../components/ui/Button';
import type { Protocol, ProtocolSignature } from '../../../types/protocols';
import type { ProtocolPermissions } from '../../../utils/protocolPermissions';

const signatureTime = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' }).format(date);
};

export const sortedProtocolSignatures = (signatures: ProtocolSignature[]) =>
  [...signatures].sort((left, right) =>
    new Date(left.signedAt).getTime() - new Date(right.signedAt).getTime());

export const protocolSignUnavailableReason = (
  protocol: Protocol,
  permissions: ProtocolPermissions,
): string => {
  if (protocol.signedByCurrentUser) return '✓ Вы подписали этот протокол';
  const signatureCount = protocol.signatureCount;
  const maxSignatures = protocol.maxSignatures;
  if (signatureCount >= maxSignatures) {
    return `Достигнуто максимальное количество подписей: ${maxSignatures}`;
  }
  if (!['READY', 'READY_FOR_APPROVAL', 'APPROVED', 'SIGNED'].includes(protocol.status)) {
    return ['ARCHIVED', 'REPLACED', 'CANCELLED'].includes(protocol.status)
      ? 'Подписание недоступно для текущего статуса'
      : 'Подписание будет доступно после утверждения протокола';
  }
  if (!permissions.canSign) return 'У вас нет доступа к подписанию протокола';
  return '';
};

type Props = {
  protocol: Protocol;
  permissions: ProtocolPermissions;
  loading?: boolean;
  signing?: boolean;
  onSign: () => void;
};

const ProtocolSignaturesCard = ({
  protocol,
  permissions,
  loading = false,
  signing = false,
  onSign,
}: Props) => {
  const signatures = sortedProtocolSignatures(protocol.signatures || []);
  const signatureCount = protocol.signatureCount;
  const maxSignatures = protocol.maxSignatures;
  const reason = protocolSignUnavailableReason(protocol, permissions);
  const canSign = permissions.canSign && !reason;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="protocol-signatures-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="protocol-signatures-title" className="text-lg font-black text-slate-950">Подписи</h2>
          <p className="mt-1 text-sm font-semibold text-slate-600">
            Подписей: {signatureCount} из {maxSignatures}
          </p>
        </div>
        {protocol.signedByCurrentUser ? (
          <p className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-50 px-4 text-sm font-bold text-emerald-800">
            <CheckCircle2 className="h-4 w-4" /> Вы подписали этот протокол
          </p>
        ) : (
          <div className="text-right">
            <Button type="button" onClick={onSign} disabled={!canSign || signing}>
              {signing ? 'Подписание…' : 'Подписать'}
            </Button>
            {reason && <p className="mt-2 max-w-sm text-sm text-slate-600">{reason}</p>}
          </div>
        )}
      </div>

      {loading ? (
        <div aria-label="Загрузка подписей" className="mt-5 space-y-3 animate-pulse">
          {[0, 1].map((item) => <div key={item} className="h-16 rounded-xl bg-slate-100" />)}
        </div>
      ) : signatures.length ? (
        <ul className="mt-5 divide-y divide-slate-100">
          {signatures.map((signature) => (
            <li key={signature.id} className="flex gap-3 py-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              <div>
                <p className="font-bold text-slate-900">{signature.signerFullName}</p>
                {signature.signerPosition && <p className="mt-0.5 text-sm text-slate-600">{signature.signerPosition}</p>}
                <time className="mt-1 block text-sm text-slate-500" dateTime={signature.signedAt}>
                  {signatureTime(signature.signedAt)}
                </time>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Протокол ещё не подписан</p>
      )}
    </section>
  );
};

export default ProtocolSignaturesCard;
