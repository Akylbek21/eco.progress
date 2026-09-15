package kz.eco.normative.dsm32;

import kz.eco.normative.ImportNormativeType;
import kz.eco.normative.NormativeRecord;
import kz.eco.normative.NormativeRecordRepository;
import kz.eco.normative.SourceDocumentCode;
import kz.eco.normative.TemplateType;
import kz.eco.normative.EnvironmentType;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.Objects;

@Component
public class Dsm32NormativeUpserter {

    private final NormativeRecordRepository normativeRecordRepository;

    public Dsm32NormativeUpserter(NormativeRecordRepository normativeRecordRepository) {
        this.normativeRecordRepository = normativeRecordRepository;
    }

    public enum UpsertAction { CREATED, UPDATED, UNCHANGED }

    public record UpsertResult(UpsertAction action, NormativeRecord record) {
    }

    public UpsertResult upsert(Dsm32ImportContext context, NormativeRecord candidate) {
        return upsert(context, candidate, null);
    }

    /** Same upsert logic, but stamps {@code importBatchId} on every touched record (created or
     *  updated) so the import can be audited/rolled back per batch, matching the DSM-138 pattern. */
    public UpsertResult upsert(Dsm32ImportContext context, NormativeRecord candidate, Long importBatchId) {
        applyDefaults(context, candidate);
        candidate.setImportBatchId(importBatchId);

        var existing = normativeRecordRepository.findDsm32ByUniqueKey(
                SourceDocumentCode.DSM_32.name(),
                candidate.getTableNo(),
                candidate.getIndicatorNameRu(),
                candidate.getFormType(),
                candidate.getMatrixType(),
                candidate.getAssessmentCategory(),
                candidate.getPollutionDegree());

        if (existing.isEmpty()) {
            NormativeRecord saved = normativeRecordRepository.save(candidate);
            return new UpsertResult(UpsertAction.CREATED, saved);
        }

        NormativeRecord record = existing.getFirst();
        boolean changed = updateIfDifferent(record, candidate);
        if (importBatchId != null && !importBatchId.equals(record.getImportBatchId())) {
            record.setImportBatchId(importBatchId);
            changed = true;
        }
        if (!changed) {
            return new UpsertResult(UpsertAction.UNCHANGED, record);
        }
        return new UpsertResult(UpsertAction.UPDATED, normativeRecordRepository.save(record));
    }

    private void applyDefaults(Dsm32ImportContext context, NormativeRecord record) {
        record.setSourceDocumentCode(SourceDocumentCode.DSM_32.name());
        record.setSourceDocumentName(Dsm32ImportContext.SOURCE_DOCUMENT_NAME);
        record.setDocumentNumber(Dsm32ImportContext.DOCUMENT_NUMBER);
        record.setDocumentDate(context.documentDate() != null
                ? context.documentDate() : Dsm32ImportContext.DOCUMENT_DATE);
        record.setTemplateType(TemplateType.SOIL);
        record.setEnvironmentType(EnvironmentType.SOIL);
        record.setActive(true);
        if (record.getTableNo() == null) {
            record.setTableNo(context.tableNo());
        }
        if (record.getSourceFile() == null) {
            record.setSourceFile(context.fileName());
        }
        if (record.getNormativeDocument() == null || record.getNormativeDocument().isBlank()) {
            record.setNormativeDocument(formatNormativeDocument(record.getTableNo()));
        }
        if (record.getVersion() <= 0) {
            record.setVersion(1);
        }
        if (record.getNormativeType() == null) {
            record.setNormativeType(ImportNormativeType.PDK);
        }
    }

    public static String formatNormativeDocument(Integer tableNo) {
        return "Приказ МЗ РК № ҚР ДСМ-32 от 21.04.2021, таблица " + tableNo;
    }

    private boolean updateIfDifferent(NormativeRecord existing, NormativeRecord candidate) {
        boolean changed = false;
        changed |= setIfDifferent(existing::setMinValue, existing.getMinValue(), candidate.getMinValue());
        changed |= setIfDifferent(existing::setMaxValue, existing.getMaxValue(), candidate.getMaxValue());
        changed |= setIfDifferent(existing::setValue, existing.getValue(), candidate.getValue());
        changed |= setIfDifferent(existing::setUnit, existing.getUnit(), candidate.getUnit());
        changed |= setIfDifferent(existing::setComparisonType, existing.getComparisonType(), candidate.getComparisonType());
        changed |= setIfDifferent(existing::setNormativeDocument, existing.getNormativeDocument(), candidate.getNormativeDocument());
        changed |= setIfDifferent(existing::setIndicatorNameRu, existing.getIndicatorNameRu(), candidate.getIndicatorNameRu());
        changed |= setIfDifferent(existing::setLimitingIndicator, existing.getLimitingIndicator(), candidate.getLimitingIndicator());
        changed |= setIfDifferent(existing::setSourceRawValue, existing.getSourceRawValue(), candidate.getSourceRawValue());
        changed |= setIfDifferent(existing::setConditionJson, existing.getConditionJson(), candidate.getConditionJson());
        changed |= setIfDifferent(existing::setMatrixType, existing.getMatrixType(), candidate.getMatrixType());
        changed |= setIfDifferent(existing::setAssessmentCategory, existing.getAssessmentCategory(), candidate.getAssessmentCategory());
        changed |= setIfDifferent(existing::setPollutionDegree, existing.getPollutionDegree(), candidate.getPollutionDegree());
        changed |= setIfDifferent(existing::setFormType, existing.getFormType(), candidate.getFormType());
        changed |= setIfDifferent(existing::setNormativeType, existing.getNormativeType(), candidate.getNormativeType());
        changed |= setIfDifferent(existing::setSourceFile, existing.getSourceFile(), candidate.getSourceFile());
        return changed;
    }

    private static <T> boolean setIfDifferent(java.util.function.Consumer<T> setter, T current, T next) {
        if (Objects.equals(current, next)) {
            return false;
        }
        setter.accept(next);
        return true;
    }
}
