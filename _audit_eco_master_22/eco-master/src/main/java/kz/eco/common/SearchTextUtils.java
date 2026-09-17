package kz.eco.common;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

public final class SearchTextUtils {

    private static final Pattern TOKEN_SPLIT = Pattern.compile("[\\s,;]+");
    private static final Pattern EXTRA_SPACES = Pattern.compile("\\s+");

    private SearchTextUtils() {
    }

    public static String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return null;
    }

    public static String normalizeText(String value) {
        if (value == null) {
            return "";
        }
        String collapsed = collapseWhitespace(value);
        return normalizeYo(collapsed.toLowerCase(Locale.ROOT));
    }

    public static String collapseWhitespace(String value) {
        if (value == null) {
            return "";
        }
        return EXTRA_SPACES.matcher(value.trim()).replaceAll(" ").trim();
    }

    public static String normalizeYo(String value) {
        return value.replace('ё', 'е');
    }

    public static List<String> searchTokens(String searchText) {
        if (searchText == null || searchText.isBlank()) {
            return List.of();
        }
        String whole = searchText.trim();
        Set<String> tokens = new LinkedHashSet<>();
        tokens.add(whole);
        for (String part : TOKEN_SPLIT.split(whole)) {
            if (!part.isBlank()) {
                tokens.add(part.trim());
            }
        }
        return new ArrayList<>(tokens);
    }
}
