package kz.eco.normative.dsm138;

import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Maps a DSM_138 XLS file to its appendix/table/category/water-type/column-layout, based on the
 * appendix and table numbers found in the file name. Matching is done by (appendixNo, tableNo)
 * rather than the exact file name text on purpose: the files actually shipped in
 * DSM_138_water_normatives_renamed.zip differ slightly from the names in the original ticket
 * (e.g. "..._table_3_organoleptic_indicators.xls" vs "..._table_3_drinking_water_organoleptic.xls"),
 * so relying on literal name equality would silently skip real files.
 */
public record Dsm138FileMapping(Integer appendixNo, Integer tableNo, Dsm138Category category,
                                 String waterType, Layout layout) {

    public enum Layout {
        /** № | indicator | unit | normative | limiting indicator | hazard class (appendix 1 tables). */
        STANDARD,
        /** № | substance name | synonyms | normative (mg/l) | limiting indicator | hazard class (appendix 2). */
        WITH_SYNONYMS,
        /** № | substance name | CAS number | PDK (mg/l) | limiting indicator | hazard class (appendix 4). */
        WITH_CAS
    }

    private static final Pattern APPENDIX_PATTERN =
            Pattern.compile("appendix_(\\d+)(?:_table_(\\d+))?", Pattern.CASE_INSENSITIVE);

    public static Dsm138FileMapping fromFileName(String fileName) {
        if (fileName == null || fileName.isBlank()) {
            return null;
        }
        Matcher matcher = APPENDIX_PATTERN.matcher(fileName.toLowerCase(Locale.ROOT));
        if (!matcher.find()) {
            return null;
        }
        int appendixNo = Integer.parseInt(matcher.group(1));
        Integer tableNo = matcher.group(2) != null ? Integer.parseInt(matcher.group(2)) : null;

        return switch (appendixNo) {
            case 1 -> new Dsm138FileMapping(1, tableNo, Dsm138Category.DRINKING_WATER_SAFETY, "DRINKING_WATER", Layout.STANDARD);
            case 2 -> new Dsm138FileMapping(2, null, Dsm138Category.DRINKING_WATER_CHEMICALS, "DRINKING_WATER", Layout.WITH_SYNONYMS);
            case 3 -> new Dsm138FileMapping(3, tableNo, Dsm138Category.SURFACE_WATER_SAFETY, "SURFACE_WATER", Layout.STANDARD);
            case 4 -> new Dsm138FileMapping(4, null, Dsm138Category.SURFACE_WATER_PDK, "SURFACE_WATER", Layout.WITH_CAS);
            default -> null;
        };
    }
}
