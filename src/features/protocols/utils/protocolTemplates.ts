import type { ProtocolTemplateId } from '../../../types/protocols';

export interface ProtocolTemplateConfig {
  id: ProtocolTemplateId;
  label: string;
  requiresSample: boolean;
  requiresEnvironment: boolean;
  requiresMeasurementPlace: boolean;
  requiresDevice: boolean;
  resultColumns: string[];
}

export const PROTOCOL_TEMPLATES: Record<ProtocolTemplateId, ProtocolTemplateConfig> = {
  ambient_air: { id: 'ambient_air', label: 'Атмосферный воздух', requiresSample: true, requiresEnvironment: true, requiresMeasurementPlace: true, requiresDevice: true, resultColumns: ['indicator', 'unit', 'normative', 'result', 'measurementDeviceId'] },
  workplace_air: { id: 'workplace_air', label: 'Воздух рабочей зоны', requiresSample: true, requiresEnvironment: true, requiresMeasurementPlace: true, requiresDevice: true, resultColumns: ['indicator', 'unit', 'normative', 'result', 'measurementDeviceId'] },
  soil: { id: 'soil', label: 'Почва', requiresSample: true, requiresEnvironment: true, requiresMeasurementPlace: true, requiresDevice: true, resultColumns: ['sampleNumber', 'samplingPlace', 'samplingDepth', 'indicator', 'unit', 'normative', 'result', 'measurementDeviceId'] },
  microclimate: { id: 'microclimate', label: 'Микроклимат', requiresSample: false, requiresEnvironment: true, requiresMeasurementPlace: true, requiresDevice: true, resultColumns: ['measurementPlace', 'indicator', 'unit', 'normative', 'result', 'measurementDeviceId'] },
  lighting: { id: 'lighting', label: 'Освещённость', requiresSample: false, requiresEnvironment: true, requiresMeasurementPlace: true, requiresDevice: true, resultColumns: ['measurementPlace', 'indicator', 'unit', 'normative', 'result', 'measurementDeviceId'] },
  noise_vibration: { id: 'noise_vibration', label: 'Шум и вибрация', requiresSample: false, requiresEnvironment: true, requiresMeasurementPlace: true, requiresDevice: true, resultColumns: ['measurementPlace', 'factorType', 'indicator', 'unit', 'normative', 'result', 'measurementDeviceId'] },
  water_wastewater: { id: 'water_wastewater', label: 'Вода и сточные воды', requiresSample: true, requiresEnvironment: true, requiresMeasurementPlace: true, requiresDevice: true, resultColumns: ['sampleNumber', 'samplingPlace', 'indicator', 'unit', 'normative', 'result', 'measurementDeviceId'] },
  uv_emf_laser: { id: 'uv_emf_laser', label: 'УФ, ЭМП и лазерное излучение', requiresSample: false, requiresEnvironment: true, requiresMeasurementPlace: true, requiresDevice: true, resultColumns: ['measurementPlace', 'factorType', 'indicator', 'unit', 'normative', 'result', 'measurementDeviceId'] },
};

export const isProtocolTemplateId = (value: unknown): value is ProtocolTemplateId =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(PROTOCOL_TEMPLATES, value);
