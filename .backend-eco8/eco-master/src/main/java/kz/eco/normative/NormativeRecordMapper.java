package kz.eco.normative;

import kz.eco.normative.dsm32.Dsm32NormativeUpserter;
import kz.eco.protocol.ComparisonType;
import kz.eco.protocol.ProtocolApiMapper;
import kz.eco.protocol.dto.ProtocolApiDtos;
import org.springframework.stereotype.Component;

@Component
public class NormativeRecordMapper {

    public ProtocolApiDtos.NormativeRecord toApi(NormativeRecord record) {
        return toApi(record, null);
    }

    public ProtocolApiDtos.NormativeRecord toApi(NormativeRecord record, String ignoredTemplateOverride) {
        if (record == null) {
            return null;
        }

        String templateId = NormativeApiContract.resolveTemplateId(record);
        String sourceDocumentCode = NormativeApiContract.resolveSourceDocumentCode(record);
        if (SourceDocumentCode.DSM_32.name().equals(sourceDocumentCode)
                && (templateId == null || templateId.isBlank())) {
            return null;
        }
        String sourceDocumentName = NormativeApiContract.resolveSourceDocumentName(sourceDocumentCode);
        String indicator = firstNonBlank(record.getIndicatorNameRu(), record.getPollutantCode());
        String code = PollutantCodeUtils.normalizePollutantCode(
                firstNonBlank(record.getPollutantCode(), record.getIndicatorNameRu()));
        String value = ProtocolApiMapper.decimalToString(record.getValue());
        ValueFields valueFields = resolveValueFields(record, value);
        boolean active = record.isActive();
        boolean archived = !active;

        return NormativeRecordBuilder.create()
                .id(String.valueOf(record.getId()))
                .code(code)
                .pollutantCode(record.getPollutantCode())
                .templateId(templateId)
                .researchObject(environmentSlug(record.getEnvironmentType()))
                .environment(environmentSlug(record.getEnvironmentType()))
                .indicator(indicator)
                .indicatorName(indicator)
                .indicatorNameRu(record.getIndicatorNameRu())
                .indicatorNameKz(record.getIndicatorNameKz())
                .pollutantName(indicator)
                .unit(record.getUnit())
                .normativeType(NormativeTypeLabels.fromImportType(record.getNormativeType()))
                .value(valueFields.value())
                .normativeValue(valueFields.value())
                .maxOneTimeValue(valueFields.maxOneTimeValue())
                .dailyAverageValue(valueFields.dailyAverageValue())
                .singleValue(valueFields.singleValue())
                .obuvValue(valueFields.obuvValue())
                .min(ProtocolApiMapper.decimalToString(record.getMinValue()))
                .max(ProtocolApiMapper.decimalToString(record.getMaxValue()))
                .comparisonType(ProtocolApiMapper.toApiComparison(record.getComparisonType()))
                .normativeDocument(resolveNormativeDocument(record))
                .testingMethod(record.getTestingMethod())
                .samplingMethod(record.getSamplingMethod())
                .validFrom(ProtocolApiMapper.formatDate(record.getEffectiveFrom()))
                .validUntil(ProtocolApiMapper.formatDate(record.getEffectiveTo()))
                .casNumber(record.getCasNumber())
                .formula(record.getChemicalFormula())
                .chemicalFormula(record.getChemicalFormula())
                .templateType(record.getTemplateType() != null ? record.getTemplateType().name() : null)
                .environmentType(record.getEnvironmentType() != null ? record.getEnvironmentType().name() : null)
                .normativeSubType(record.getNormativeSubType())
                .hazardClass(record.getHazardClass())
                .limitingIndicator(record.getLimitingIndicator())
                .sourceFile(record.getSourceFile())
                .active(active)
                .archived(archived)
                .sourceDocumentCode(sourceDocumentCode)
                .sourceDocumentName(sourceDocumentName)
                .documentNumber(record.getDocumentNumber())
                .documentDate(ProtocolApiMapper.formatDate(record.getDocumentDate()))
                .appendixNo(record.getAppendixNo())
                .tableNo(record.getTableNo())
                .factorType(record.getFactorType())
                .factorCode(record.getFactorCode())
                .roomType(record.getRoomType())
                .season(record.getSeason())
                .workCategory(record.getWorkCategory())
                .workplaceType(record.getWorkplaceType())
                .normLevel(record.getNormLevel())
                .conditionJson(record.getConditionJson())
                .matrixType(record.getMatrixType())
                .assessmentCategory(record.getAssessmentCategory())
                .pollutionDegree(record.getPollutionDegree())
                .formType(record.getFormType())
                .categoryCode(record.getCategoryCode())
                .waterType(record.getWaterType())
                .waterUseCategory(record.getWaterUseCategory())
                .synonyms(record.getSynonyms())
                .build();
    }

    private static ValueFields resolveValueFields(NormativeRecord record, String value) {
        String maxOneTime = null;
        String dailyAverage = null;
        String obuv = null;
        String single = null;
        String resolvedValue = value;

        if (record.getNormativeType() == ImportNormativeType.OBUV) {
            obuv = value;
            resolvedValue = null;
        } else if (NormativeSubType.MAX_ONE_TIME.equals(record.getNormativeSubType())) {
            maxOneTime = value;
            resolvedValue = null;
        } else if (NormativeSubType.DAILY_AVERAGE.equals(record.getNormativeSubType())) {
            dailyAverage = value;
            resolvedValue = null;
        } else if (record.getComparisonType() == ComparisonType.RANGE) {
            resolvedValue = null;
        } else if (value != null) {
            single = value;
        }

        return new ValueFields(resolvedValue, maxOneTime, dailyAverage, single, obuv);
    }

    private static String environmentSlug(EnvironmentType type) {
        if (type == null) {
            return null;
        }
        return switch (type) {
            case ATMOSPHERIC_AIR -> "atmospheric_air";
            case WORK_ZONE_AIR -> "work_zone_air";
            case WATER -> "water";
            case SOIL -> "soil";
            case FOOD -> "food";
            case SURFACE -> "surface";
            case SPECIAL -> "special";
            default -> type.name().toLowerCase();
        };
    }

    private static String resolveNormativeDocument(NormativeRecord record) {
        if (record.getNormativeDocument() != null && !record.getNormativeDocument().isBlank()) {
            return record.getNormativeDocument();
        }
        if (SourceDocumentCode.DSM_15.name().equals(record.getSourceDocumentCode())
                && record.getAppendixNo() != null && record.getTableNo() != null) {
            return kz.eco.normative.physical.PhysicalFactorNormativeUpserter.formatNormativeDocument(
                    record.getAppendixNo(), record.getTableNo());
        }
        if (SourceDocumentCode.DSM_32.name().equals(record.getSourceDocumentCode())
                && record.getTableNo() != null) {
            return Dsm32NormativeUpserter.formatNormativeDocument(record.getTableNo());
        }
        SourceDocumentCode code = SourceDocumentCode.fromApi(record.getSourceDocumentCode());
        if (code != null) {
            return code.documentNumber();
        }
        return firstNonBlank(record.getDocumentNumber());
    }

    private static String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    private record ValueFields(
            String value,
            String maxOneTimeValue,
            String dailyAverageValue,
            String singleValue,
            String obuvValue
    ) {
    }
}
