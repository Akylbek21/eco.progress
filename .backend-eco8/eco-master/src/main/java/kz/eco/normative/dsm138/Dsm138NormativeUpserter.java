package kz.eco.normative.dsm138;

import kz.eco.normative.NormativeRecord;
import kz.eco.normative.NormativeRecordRepository;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Dedupes on (sourceDocumentCode, appendixNo, tableNo, categoryCode, indicatorName, casNumber,
 * unit, value) as specified by the ticket. Matching is not restricted to active=true records so
 * that re-importing after a rollback (which deactivates rows) reactivates the same row instead of
 * creating a new one next to a deactivated duplicate.
 */
@Component
public class Dsm138NormativeUpserter {

    public enum Action { CREATED, UPDATED }

    public record UpsertResult(Action action, NormativeRecord record) {
    }

    private final NormativeRecordRepository repository;

    public Dsm138NormativeUpserter(NormativeRecordRepository repository) {
        this.repository = repository;
    }

    public UpsertResult upsert(NormativeRecord candidate, Long importBatchId) {
        List<NormativeRecord> existing = repository.findDsm138ByUniqueKey(
                candidate.getSourceDocumentCode(),
                candidate.getAppendixNo(),
                candidate.getTableNo(),
                candidate.getCategoryCode(),
                candidate.getIndicatorNameRu(),
                candidate.getCasNumber(),
                candidate.getUnit(),
                candidate.getValue());

        if (existing.isEmpty()) {
            candidate.setImportBatchId(importBatchId);
            return new UpsertResult(Action.CREATED, repository.save(candidate));
        }

        NormativeRecord record = existing.getFirst();
        record.setActive(true);
        record.setMinValue(candidate.getMinValue());
        record.setMaxValue(candidate.getMaxValue());
        record.setComparisonType(candidate.getComparisonType());
        record.setAlternativeNormativeValue(candidate.getAlternativeNormativeValue());
        record.setNotes(candidate.getNotes());
        record.setLimitingIndicator(candidate.getLimitingIndicator());
        record.setHazardClass(candidate.getHazardClass());
        record.setSynonyms(candidate.getSynonyms());
        record.setWaterType(candidate.getWaterType());
        record.setSectionName(candidate.getSectionName());
        record.setSourceFile(candidate.getSourceFile());
        record.setSourceRowNumber(candidate.getSourceRowNumber());
        record.setSourceRawValue(candidate.getSourceRawValue());
        record.setDocumentDate(candidate.getDocumentDate());
        record.setImportBatchId(importBatchId);
        return new UpsertResult(Action.UPDATED, repository.save(record));
    }
}
