package kz.eco.normative.physical;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class PhysicalFactorHtmlTableReader {

    private static final Pattern TD_PATTERN = Pattern.compile(
            "<td([^>]*)>(.*?)</td>",
            Pattern.CASE_INSENSITIVE | Pattern.DOTALL);
    private static final Pattern ROWSPAN_PATTERN = Pattern.compile("rowspan\\s*=\\s*\"?(\\d+)\"?", Pattern.CASE_INSENSITIVE);
    private static final Pattern COLSPAN_PATTERN = Pattern.compile("colspan\\s*=\\s*\"?(\\d+)\"?", Pattern.CASE_INSENSITIVE);
    private static final Pattern TR_PATTERN = Pattern.compile("<tr[^>]*>(.*?)</tr>", Pattern.CASE_INSENSITIVE | Pattern.DOTALL);
    private static final Pattern TAG_PATTERN = Pattern.compile("<[^>]+>");

    private PhysicalFactorHtmlTableReader() {
    }

    public static List<List<String>> readRows(InputStream inputStream) throws IOException {
        String html = new String(inputStream.readAllBytes(), StandardCharsets.UTF_8);
        if (!html.toLowerCase(Locale.ROOT).contains("<table")) {
            return List.of();
        }

        List<List<RawCell>> rawRows = new ArrayList<>();
        Matcher trMatcher = TR_PATTERN.matcher(html);
        while (trMatcher.find()) {
            List<RawCell> cells = parseRowCells(trMatcher.group(1));
            if (!cells.isEmpty()) {
                rawRows.add(cells);
            }
        }
        if (rawRows.isEmpty()) {
            return List.of();
        }

        int rowCount = rawRows.size();
        int colCount = estimateColumnCount(rawRows);
        String[][] grid = new String[rowCount][colCount];
        boolean[][] occupied = new boolean[rowCount][colCount];

        for (int r = 0; r < rowCount; r++) {
            int c = 0;
            for (RawCell cell : rawRows.get(r)) {
                while (c < colCount && occupied[r][c]) {
                    c++;
                }
                for (int dr = 0; dr < cell.rowspan; dr++) {
                    for (int dc = 0; dc < cell.colspan; dc++) {
                        int targetRow = r + dr;
                        int targetCol = c + dc;
                        if (targetRow >= rowCount) {
                            continue;
                        }
                        if (targetCol >= colCount) {
                            continue;
                        }
                        grid[targetRow][targetCol] = cell.text;
                        occupied[targetRow][targetCol] = true;
                    }
                }
                c += cell.colspan;
            }
        }

        List<List<String>> rows = new ArrayList<>();
        for (int r = 0; r < rowCount; r++) {
            List<String> row = new ArrayList<>();
            for (int c = 0; c < colCount; c++) {
                row.add(grid[r][c] != null ? grid[r][c] : "");
            }
            if (row.stream().anyMatch(value -> value != null && !value.isBlank())) {
                rows.add(row);
            }
        }
        return rows;
    }

    private static int estimateColumnCount(List<List<RawCell>> rawRows) {
        int max = 0;
        for (List<RawCell> row : rawRows) {
            int width = 0;
            for (RawCell cell : row) {
                width += cell.colspan;
            }
            max = Math.max(max, width);
        }
        return Math.max(max, 12);
    }

    private static List<RawCell> parseRowCells(String rowHtml) {
        List<RawCell> cells = new ArrayList<>();
        Matcher tdMatcher = TD_PATTERN.matcher(rowHtml);
        while (tdMatcher.find()) {
            String attrs = tdMatcher.group(1);
            String content = cleanText(tdMatcher.group(2));
            int rowspan = parseIntAttr(attrs, ROWSPAN_PATTERN, 1);
            int colspan = parseIntAttr(attrs, COLSPAN_PATTERN, 1);
            cells.add(new RawCell(content, rowspan, colspan));
        }
        return cells;
    }

    private static int parseIntAttr(String attrs, Pattern pattern, int defaultValue) {
        Matcher matcher = pattern.matcher(attrs);
        if (matcher.find()) {
            try {
                return Integer.parseInt(matcher.group(1));
            } catch (NumberFormatException ignored) {
            }
        }
        return defaultValue;
    }

    private static String cleanText(String raw) {
        if (raw == null) {
            return "";
        }
        String withoutTags = TAG_PATTERN.matcher(raw).replaceAll(" ");
        return withoutTags
                .replace("&nbsp;", " ")
                .replace("&sup2;", "²")
                .replace("&sup3;", "³")
                .replace("&deg;", "°")
                .replace('\u00a0', ' ')
                .replaceAll("\\s+", " ")
                .trim();
    }

    private record RawCell(String text, int rowspan, int colspan) {
    }
}
