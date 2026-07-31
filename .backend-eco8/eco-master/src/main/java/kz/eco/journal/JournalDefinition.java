package kz.eco.journal;

import java.util.List;

/**
 * primaryDateKey names the column (within each entry's data map) that represents the entry's
 * date. Every journal type uses a different key for its date column (registrationDate, date,
 * protocolRegistrationDate, preparationDate), so the backend needs this mapping to populate the
 * indexed entry_date column used for dateFrom/dateTo filtering.
 */
public record JournalDefinition(JournalType code, String title, String primaryDateKey,
                                 List<JournalColumn> columns, List<String> requiredKeys) {
}
