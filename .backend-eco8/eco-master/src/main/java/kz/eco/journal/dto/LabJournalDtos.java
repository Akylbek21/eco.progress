package kz.eco.journal.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import kz.eco.journal.JournalColumn;

import java.util.List;
import java.util.Map;

public final class LabJournalDtos {

    private LabJournalDtos() {
    }

    public record JournalTypeResponse(String code, String title, List<JournalColumn> columns) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record JournalEntryRequest(
            String journalType,
            String entryDate,
            /** Alias of {@code entryDate}, accepted for SOLUTION_PREPARATION per the spec. */
            String preparationDate,
            Long laboratoryId,
            Map<String, Object> data,
            /** Alias of {@code data}, accepted for SOLUTION_PREPARATION per the spec. */
            Map<String, Object> fields,
            /** Optional soft link to the protocol/result that produced this entry (section 29 of the
             *  spec). Not validated against the protocol tables - this module has no hard dependency
             *  on them. */
            Long protocolId,
            Long protocolResultId,
            String sampleId
    ) {
        public String effectiveEntryDate() {
            return entryDate != null && !entryDate.isBlank() ? entryDate : preparationDate;
        }

        public Map<String, Object> effectiveData() {
            return data != null && !data.isEmpty() ? data : fields;
        }
    }

    public record JournalEntryResponse(
            Long id,
            String journalType,
            Integer rowNumber,
            String entryDate,
            Long laboratoryId,
            String laboratoryName,
            Map<String, Object> data,
            Long createdBy,
            String createdByName,
            String createdAt,
            String updatedAt,
            Long protocolId,
            Long protocolResultId,
            String sampleId
    ) {
    }

    public record PageResponse<T>(List<T> content, long totalElements, int totalPages, int number, int size) {
    }
}
