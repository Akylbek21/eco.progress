package kz.eco.normative.physical;

import kz.eco.normative.*;
import kz.eco.protocol.ComparisonType;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.Objects;

@Component
public class PhysicalFactorNormativeUpserter {

    private final NormativeRecordRepository normativeRecordRepository;

    public PhysicalFactorNormativeUpserter(NormativeRecordRepository normativeRecordRepository) {
        this.normativeRecordRepository = normativeRecordRepository;
    }

    public enum UpsertAction { CREATED, UPDATED, UNCHANGED }

    public record UpsertResult(UpsertAction action, NormativeRecord record) {
    }

    public UpsertResult upsert(PhysicalFactorImportContext context, NormativeRecord candidate) {
        return upsert(context, candidate, null);
    }

    /** Same upsert logic, but stamps {@code importBatchId} on every touched record (created or
     *  updated) so the import can be audited/rolled back per batch, matching the DSM-138 pattern. */
    public UpsertResult upsert(PhysicalFactorImportContext context, NormativeRecord candidate, Long importBatchId) {
        applyDefaults(context, candidate);
        candidate.setImportBatchId(importBatchId);
        String conditionJson = normalizeJson(candidate.getConditionJson());

        var existing = normativeRecordRepository.findPhysicalFactorByUniqueKey(
                SourceDocumentCode.DSM_15.name(),
                candidate.getAppendixNo(),
                candidate.getTableNo(),
                candidate.getFactorType(),
                candidate.getFactorCode(),
                candidate.getSeason(),
                candidate.getWorkCategory(),
                candidate.getWorkplaceType(),
                candidate.getNormLevel(),
                candidate.getRoomType(),
                conditionJson);

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

    private void applyDefaults(PhysicalFactorImportContext context, NormativeRecord record) {
        record.setSourceDocumentCode(SourceDocumentCode.DSM_15.name());
        record.setSourceDocumentName(PhysicalFactorImportContext.SOURCE_DOCUMENT_NAME);
        record.setDocumentNumber(PhysicalFactorImportContext.DOCUMENT_NUMBER);
        record.setDocumentDate(context.documentDate());
        record.setTemplateType(TemplateType.PHYSICAL_FACTORS);
        record.setEnvironmentType(EnvironmentType.SPECIAL);
        record.setNormativeType(ImportNormativeType.PDK);
        record.setActive(true);
        if (record.getAppendixNo() == null) {
            record.setAppendixNo(context.appendixNo());
        }
        if (record.getTableNo() == null) {
            record.setTableNo(context.tableNo());
        }
        if (record.getFactorType() == null || record.getFactorType().isBlank()) {
            record.setFactorType(context.factorType());
        }
        if (record.getSourceFile() == null) {
            record.setSourceFile(context.fileName());
        }
        if (record.getNormativeDocument() == null || record.getNormativeDocument().isBlank()) {
            record.setNormativeDocument(formatNormativeDocument(record.getAppendixNo(), record.getTableNo()));
        }
        if (record.getVersion() <= 0) {
            record.setVersion(1);
        }
    }

    public static String formatNormativeDocument(Integer appendixNo, Integer tableNo) {
        return "Приказ МЗ РК № ҚР ДСМ-15 от 16.02.2022, приложение "
                + appendixNo + ", таблица " + tableNo;
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
        changed |= setIfDifferent(existing::setSourceDocumentName, existing.getSourceDocumentName(), candidate.getSourceDocumentName());
        changed |= setIfDifferent(existing::setDocumentNumber, existing.getDocumentNumber(), candidate.getDocumentNumber());
        changed |= setIfDifferent(existing::setDocumentDate, existing.getDocumentDate(), candidate.getDocumentDate());
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

    private static String normalizeJson(String json) {
        if (json == null || json.isBlank()) {
            return null;
        }
        return json.trim();
    }
}
