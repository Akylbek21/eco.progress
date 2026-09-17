package kz.eco.normative.dsm32;

public final class Dsm32NameCleaner {

    private Dsm32NameCleaner() {
    }

    public static String cleanSubstanceName(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String cleaned = raw.trim()
                .replaceAll("\\*\\s*\\(\\d+\\)", "")
                .replaceAll("\\*", "")
                .trim();
        return cleaned.isBlank() ? null : cleaned;
    }

    public static boolean isComplexValue(String raw) {
        return raw != null && raw.contains("+");
    }

    public static boolean isHeaderOrGroupRow(String firstCell, String secondCell) {
        if (firstCell != null && firstCell.toLowerCase().contains("№")) {
            return true;
        }
        if (secondCell != null) {
            String lower = secondCell.toLowerCase();
            if (lower.contains("наименование") || lower.contains("степень") || lower.contains("показат")) {
                return true;
            }
        }
        return firstCell != null && firstCell.matches("[1-4]") && secondCell != null && secondCell.matches("[1-9]");
    }

    public static boolean isFormGroupRow(String cell) {
        if (cell == null || cell.isBlank()) {
            return false;
        }
        String lower = cell.toLowerCase();
        return lower.contains("форма") && (lower.contains("подвиж") || lower.contains("водораствор"));
    }
}
