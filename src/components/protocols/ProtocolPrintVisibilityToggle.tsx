import type { ProtocolPrintField, ProtocolPrintVisibility } from '../../types/protocols';
import { isProtocolFieldVisible, setProtocolFieldsVisibility } from '../../utils/protocolPrintVisibility';

type Props = {
  field: ProtocolPrintField;
  visibility?: ProtocolPrintVisibility;
  readOnly?: boolean;
  relatedFields?: readonly ProtocolPrintField[];
  onChange: (visibility: ProtocolPrintVisibility) => void;
};

const ProtocolPrintVisibilityToggle = ({ field, visibility, readOnly = false, relatedFields = [], onChange }: Props) => {
  const fields = [field, ...relatedFields];
  const hidden = fields.some((item) => !isProtocolFieldVisible(visibility, item));
  return (
  <span className="mt-2 inline-flex items-center gap-2 text-xs font-semibold text-slate-600">
    <input
      type="checkbox"
      aria-label="Не выводить в протокол"
      checked={hidden}
      disabled={readOnly}
      onChange={(event) => onChange(setProtocolFieldsVisibility(visibility, fields, !event.target.checked))}
      className="h-4 w-4 rounded border-slate-300 text-eco-600 focus:ring-eco-500"
    />
    <span>Не выводить в протокол</span>
  </span>
  );
};

export default ProtocolPrintVisibilityToggle;
