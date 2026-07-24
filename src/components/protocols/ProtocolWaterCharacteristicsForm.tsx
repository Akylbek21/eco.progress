import {
  WATER_TYPE_OPTIONS,
  WATER_USE_CATEGORY_OPTIONS,
  type ProtocolSelectOption,
} from '../../config/protocolWater';

type Props = {
  waterType: string;
  waterUseCategory: string;
  readOnly?: boolean;
  waterTypeOptions?: ProtocolSelectOption[];
  waterUseCategoryOptions?: ProtocolSelectOption[];
  errors?: Partial<Record<'waterType' | 'waterUseCategory', string>>;
  onChange: (value: { waterType: string; waterUseCategory: string }) => void;
};

const input = 'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-eco-500 focus:outline-none focus:ring-4 focus:ring-eco-100 disabled:bg-slate-100';

const ProtocolWaterCharacteristicsForm = ({
  waterType,
  waterUseCategory,
  readOnly = false,
  waterTypeOptions = WATER_TYPE_OPTIONS,
  waterUseCategoryOptions = WATER_USE_CATEGORY_OPTIONS,
  errors = {},
  onChange,
}: Props) => (
  <fieldset id="water-characteristics" className="rounded-2xl border border-sky-200 bg-sky-50/60 p-4">
    <legend className="px-1 text-base font-black text-slate-900">Характеристики воды</legend>
    <div className="mt-3 grid gap-4 md:grid-cols-2">
      <label htmlFor="protocol-waterType" className="text-sm font-bold">
        Тип воды
        <select
          id="protocol-waterType"
          required
          value={waterType}
          disabled={readOnly}
          aria-invalid={Boolean(errors.waterType)}
          onChange={(event) => onChange({ waterType: event.target.value, waterUseCategory })}
          className={`${input} ${errors.waterType ? 'border-rose-400' : ''}`}
        >
          <option value="">Выберите тип воды</option>
          {waterTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        {errors.waterType && <span className="mt-1 block text-sm font-semibold text-rose-700">{errors.waterType}</span>}
      </label>
      <label htmlFor="protocol-waterUseCategory" className="text-sm font-bold">
        Категория водопользования
        <select
          id="protocol-waterUseCategory"
          required
          value={waterUseCategory}
          disabled={readOnly}
          aria-invalid={Boolean(errors.waterUseCategory)}
          onChange={(event) => onChange({ waterType, waterUseCategory: event.target.value })}
          className={`${input} ${errors.waterUseCategory ? 'border-rose-400' : ''}`}
        >
          <option value="">Выберите категорию водопользования</option>
          {waterUseCategoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        {errors.waterUseCategory && <span className="mt-1 block text-sm font-semibold text-rose-700">{errors.waterUseCategory}</span>}
      </label>
    </div>
  </fieldset>
);

export default ProtocolWaterCharacteristicsForm;
