package kz.eco.normative;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class HtmlTableParser {

    private static final Pattern TD_PATTERN = Pattern.compile("<td([^>]*)>(.*?)</td>", Pattern.DOTALL | Pattern.CASE_INSENSITIVE);
    private static final Pattern TR_PATTERN = Pattern.compile("<tr[^>]*>(.*?)</tr>", Pattern.DOTALL | Pattern.CASE_INSENSITIVE);
    private static final Pattern COLSPAN_PATTERN = Pattern.compile("colspan\\s*=\\s*\"?(\\d+)\"?", Pattern.CASE_INSENSITIVE);
    private static final Pattern TAG_PATTERN = Pattern.compile("<[^>]+>");
    private static final Pattern WHITESPACE_PATTERN = Pattern.compile("\\s+");

    public record ParsedTable(List<List<String>> rows) {}

    public static ParsedTable parse(InputStream input) throws IOException {
        String html = readAll(input);
        List<List<String>> rows = new ArrayList<>();

        Matcher trMatcher = TR_PATTERN.matcher(html);
        while (trMatcher.find()) {
            String trContent = trMatcher.group(1);
            List<String> cells = new ArrayList<>();
            Matcher tdMatcher = TD_PATTERN.matcher(trContent);
            while (tdMatcher.find()) {
                String tdAttributes = tdMatcher.group(1);
                String cellHtml = tdMatcher.group(2);
                String cellText = stripTags(cellHtml).trim();
                cellText = WHITESPACE_PATTERN.matcher(cellText).replaceAll(" ").trim();
                cells.add(cellText);

                Matcher colspanMatcher = COLSPAN_PATTERN.matcher(tdAttributes);
                if (colspanMatcher.find()) {
                    int colspan = Integer.parseInt(colspanMatcher.group(1));
                    for (int i = 1; i < colspan; i++) {
                        cells.add("");
                    }
                }
            }
            if (!cells.isEmpty()) {
                rows.add(cells);
            }
        }
        return new ParsedTable(rows);
    }

    public static boolean isHtmlFile(byte[] firstBytes) {
        String start = new String(firstBytes, 0, Math.min(firstBytes.length, 500), StandardCharsets.UTF_8).toLowerCase();
        return start.contains("<html") || start.contains("<!doctype") || start.contains("<table");
    }

    private static String stripTags(String html) {
        String text = html.replace("<br>", " ").replace("<br/>", " ").replace("<br />", " ");
        text = text.replace("&nbsp;", " ").replace("&lt;", "<").replace("&gt;", ">");
        text = text.replace("&amp;", "&").replace("&quot;", "\"");
        text = text.replace("<sup>", "").replace("</sup>", "");
        text = text.replace("<sub>", "").replace("</sub>", "");
        return TAG_PATTERN.matcher(text).replaceAll("");
    }

    private static String readAll(InputStream input) throws IOException {
        StringBuilder sb = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(input, StandardCharsets.UTF_8))) {
            char[] buffer = new char[8192];
            int read;
            while ((read = reader.read(buffer)) != -1) {
                sb.append(buffer, 0, read);
            }
        }
        return sb.toString();
    }
}
