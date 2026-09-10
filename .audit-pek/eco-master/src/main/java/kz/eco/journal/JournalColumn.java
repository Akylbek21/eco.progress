package kz.eco.journal;

/** type is one of "number", "date", "text" - matches the frontend's column renderer contract. */
public record JournalColumn(String key, String title, String type) {
}
