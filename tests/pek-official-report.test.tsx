// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import PekOfficialReport from '../src/features/pek/components/official/PekOfficialReport';
import type { PekOfficialReportData } from '../src/features/pek/api/pekContracts';

const data: PekOfficialReportData = {
  general: { companyName: 'Эко Тест', companyBin: '123', objectName: 'Площадка', kato: '1', oked: '2', environmentalCategory: 'I', coordinates: '51, 71', designCapacity: '100 т', actualCapacity: '80', actualCapacityUnit: 'т', programNumber: 'P-1', programName: 'ПЭК', regulationVersion: 'R1', regulationCode: 'RC', templateVersion: 'T1', periodStart: '2026-01-01', periodEnd: '2026-03-31', submissionDueDate: null },
  laboratory: { laboratoryId: 1, laboratoryName: 'Лаборатория', laboratoryBin: '456', accreditationNumber: 'KZ.A.1', accreditationValidFrom: '2025-01-01', accreditationValidUntil: '2027-01-01', accreditationScope: 'Воздух' },
  applicability: [
    { tableType: 'EMISSIONS', applicable: true, reason: null },
    { tableType: 'INSTRUMENTAL_MEASUREMENTS', applicable: true, reason: null },
    { tableType: 'CALCULATED_EMISSIONS', applicable: true, reason: null },
    { tableType: 'AMBIENT_AIR', applicable: false, reason: 'Нет точек' },
    { tableType: 'WASTEWATER', applicable: false, reason: 'Нет выпусков' },
    { tableType: 'WATER', applicable: false, reason: null }, { tableType: 'SOIL', applicable: false, reason: null },
    { tableType: 'RADIATION', applicable: false, reason: null }, { tableType: 'MARINE', applicable: false, reason: 'Объект не относится к морским' },
  ],
  ready: false, progressPercent: 80,
  tables: {
    emissions: [{ emissionSourceId: 1, sourceName: 'ИЗА-1', indicatorName: 'NO₂', indicatorCode: 'NO2', normativeGs: '1', normativeTonsYear: '4.5', actualGs: '2', actualTonsQuarter: '0.85', actualTonsYear: '3.7', exceedance: true, correctiveAction: 'Проверить фильтр', protocolId: 7, protocolResultId: 70 }],
    instrumentalMeasurements: [{ controlItemId: 2, monitoringPointId: 3, pointName: 'Точка 1', indicatorName: 'SO₂', indicatorCode: 'SO2', measurementDate: '2026-03-01', measurementMethod: 'ГОСТ 1', normativeValue: '0.5', actualValue: '0.4', unit: 'мг/м³', exceedance: false, exceedanceRatio: null, correctiveAction: null, protocolNumber: '№125', protocolId: 8, protocolResultId: 80 }],
    calculatedEmissions: [], ambientAir: [], wastewater: [], water: [], soil: [], radiation: [], marine: [],
  },
};

afterEach(cleanup);
const show = () => render(<MemoryRouter><PekOfficialReport data={data} /></MemoryRouter>);

describe('official PEK report backend #18 contract', () => {
  it('renders array rows and exact backend field names', () => {
    show();
    expect(screen.getByText('ИЗА-1')).toBeTruthy(); expect(screen.getByText('4.5')).toBeTruthy();
    expect(screen.getByText('0.85')).toBeTruthy(); expect(screen.getByText('ГОСТ 1')).toBeTruthy();
    expect(screen.getAllByText('Да').length).toBeGreaterThan(0); expect(screen.getByText('KZ.A.1')).toBeTruthy();
  });

  it('marks applicability=false without rendering a data table', () => {
    show();
    expect(screen.getByText('Морской мониторинг')).toBeTruthy();
    expect(screen.getByText(/Не применяется: Объект не относится к морским/)).toBeTruthy();
  });

  it('filters backend rows', () => {
    show(); fireEvent.change(screen.getByLabelText('Поиск: Выбросы'), { target: { value: 'нет строки' } });
    expect(screen.getByText('По запросу ничего не найдено.')).toBeTruthy();
  });
});
