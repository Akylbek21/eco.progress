package kz.eco.pek;

import kz.eco.common.exception.NotFoundException;
import kz.eco.company.Company;
import kz.eco.company.CompanyRepository;
import kz.eco.pek.docgen.PekReportDocumentStore;
import kz.eco.pek.dto.PekMonitoringDtos.PackageIssue;
import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.PrintSetup;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.VerticalAlignment;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Официальная таблица выбросов загрязняющих веществ в атмосферу (05_ПЭК_Выбросы.xlsx).
 *
 * <p>Replaces the generic "План-факт" sheet this service used to emit for every monitoring
 * direction - a list of control items with their planned counts, which is not the form a regulator
 * receives for emissions. The table is built per source and substance from structured records only:
 * <ul>
 *   <li>source number, name, site and coordinates - {@link PekEmissionSource};</li>
 *   <li>substance, normatives (г/с, т/год) and actual emissions (г/с, т/квартал, т/год) - the
 *       report's EMISSIONS / CALCULATED_EMISSIONS {@link PekReportResultRow}s, which collect()
 *       builds from protocol results and the program's indicators;</li>
 *   <li>emission before treatment, captured and utilised amounts and the reason for an increase -
 *       {@link PekReportEmissionBalance}; before-treatment and captured fall back to a calculation
 *       from the source's cleaning efficiency when not entered.</li>
 * </ul>
 * Over-normative emission and the deviation percent are Excel formulas over those cells, so the
 * sheet stays consistent if someone corrects a figure by hand.
 */
@Service
public class PekMonitoringExcelGenerationService {

    public static final String FILE_NAME = "05_ПЭК_Выбросы.xlsx";
    static final String SECTION = "EMISSIONS";
    static final String SHEET_NAME = "Выбросы";

    /** Header of the data table, in column order. Index constants below must match. */
    static final List<String> HEADERS = List.of(
            "Площадка",
            "№ источника",
            "Наименование источника",
            "Код вещества",
            "Наименование вещества",
            "Норматив, г/с",
            "Норматив, т/год",
            "Фактический выброс, г/с",
            "Фактический выброс, т/квартал",
            "Фактический выброс, т/год",
            "Выброс без очистки, т",
            "Уловлено, т",
            "Утилизировано, т",
            "Сверхнормативный выброс, т/год",
            "Увеличение (+) / снижение (−), %",
            "Причина увеличения",
            "Широта",
            "Долгота");

    static final int COL_NORM_TY = 6;
    static final int COL_ACT_TY = 9;
    static final int COL_OVER = 13;
    static final int COL_DEVIATION = 14;
    /** Row index (0-based) of the header; title rows sit above it. */
    static final int HEADER_ROW = 3;

    private static final int[] WIDTHS = {18, 10, 28, 10, 30, 12, 12, 13, 13, 13, 13, 12, 13, 14, 14, 34, 12, 12};
    private static final Set<PekOfficialTableType> EMISSION_TABLES =
            EnumSet.of(PekOfficialTableType.EMISSIONS, PekOfficialTableType.CALCULATED_EMISSIONS);
    private static final Pattern COORDINATES = Pattern.compile("(-?\\d{1,3}(?:[.,]\\d+)?)\\s*[,;\\s]\\s*(-?\\d{1,3}(?:[.,]\\d+)?)");

    private final PekReportResultRowRepository resultRows;
    private final PekEmissionSourceRepository sources;
    private final PekReportEmissionBalanceRepository balances;
    private final PekProgramMonitoringRepository monitoring;
    private final PekProgramRepository programs;
    private final CompanyRepository companies;
    private final PekReportDocumentStore store;
    private final PekPackagePolicy packagePolicy;

    public PekMonitoringExcelGenerationService(PekReportResultRowRepository resultRows,
                                               PekEmissionSourceRepository sources,
                                               PekReportEmissionBalanceRepository balances,
                                               PekProgramMonitoringRepository monitoring,
                                               PekProgramRepository programs, CompanyRepository companies,
                                               PekReportDocumentStore store, PekPackagePolicy packagePolicy) {
        this.resultRows = resultRows;
        this.sources = sources;
        this.balances = balances;
        this.monitoring = monitoring;
        this.programs = programs;
        this.companies = companies;
        this.store = store;
        this.packagePolicy = packagePolicy;
    }

    /** One line of the table: a substance emitted by a source over the period. */
    public record EmissionLine(Long emissionSourceId, String site, String sourceCode, String sourceName,
                               String substanceCode, String substanceName,
                               BigDecimal normativeGs, BigDecimal normativeTonsYear,
                               BigDecimal actualGs, BigDecimal actualTonsQuarter, BigDecimal actualTonsYear,
                               BigDecimal withoutTreatmentTons, BigDecimal capturedTons, BigDecimal utilizedTons,
                               String increaseReason, BigDecimal latitude, BigDecimal longitude) {

        /** Actual above the normative on either scale - the case that needs an explanation. */
        public boolean increased() {
            return greater(actualTonsYear, normativeTonsYear) || greater(actualGs, normativeGs);
        }

        private static boolean greater(BigDecimal a, BigDecimal b) {
            return a != null && b != null && a.compareTo(b) > 0;
        }
    }

    /** Whether the program declares emission-source monitoring, i.e. whether the table is required. */
    public boolean applicable(Long programId) {
        return monitoring.findByProgramIdAndActiveTrueOrderByMonitoringTypeAsc(programId).stream()
                .anyMatch(d -> d.getMonitoringType() == PekMonitoringType.EMISSION_SOURCE);
    }

    @Transactional(readOnly = true)
    public List<PackageIssue> issues(PekReport report) {
        List<PackageIssue> issues = new ArrayList<>();
        List<PekReportResultRow> rows = emissionRows(report.getId());
        if (rows.isEmpty()) {
            issues.add(new PackageIssue("EMISSIONS_NO_DATA", SECTION, report.getId(), null,
                    "Нет результатов измерений выбросов за период - соберите протоколы по источникам выбросов"));
            return issues;
        }
        Map<Long, PekEmissionSource> byId = sourcesById(report.getProgramId());
        for (PekReportResultRow r : rows) {
            String label = "«" + nz(r.getIndicatorName()) + "»";
            if (r.getEmissionSourceId() == null || !byId.containsKey(r.getEmissionSourceId())) {
                issues.add(new PackageIssue("SOURCE_REQUIRED", SECTION, r.getId(), "emissionSourceId",
                        "Результат " + label + " не привязан к источнику выбросов программы"));
            }
            if (isBlank(r.getIndicatorCode())) {
                issues.add(new PackageIssue("SUBSTANCE_CODE_REQUIRED", SECTION, r.getId(), "indicatorCode",
                        "Не указан код вещества для результата " + label));
            }
        }
        List<EmissionLine> lines = lines(report);
        for (EmissionLine l : lines) {
            String label = "источник " + nz(l.sourceCode()) + ", вещество " + nz(l.substanceCode());
            if (l.normativeGs() == null || l.normativeTonsYear() == null) {
                issues.add(new PackageIssue("NORMATIVE_REQUIRED", SECTION, l.emissionSourceId(),
                        l.normativeGs() == null ? "normativeGs" : "normativeTonsYear",
                        "Не задан норматив выброса (г/с и т/год): " + label));
            }
            if (l.actualGs() == null || l.actualTonsQuarter() == null) {
                issues.add(new PackageIssue("RESULT_REQUIRED", SECTION, l.emissionSourceId(),
                        l.actualGs() == null ? "actualGs" : "actualTonsQuarter",
                        "Нет фактического выброса (г/с и т/квартал): " + label));
            }
            if (l.increased() && isBlank(l.increaseReason())) {
                issues.add(new PackageIssue("INCREASE_REASON_REQUIRED", SECTION, l.emissionSourceId(),
                        "increaseReason", "Фактический выброс выше норматива - укажите причину увеличения: " + label));
            }
        }
        lines.stream().map(EmissionLine::emissionSourceId).filter(Objects::nonNull).distinct()
                .map(byId::get).filter(Objects::nonNull)
                .filter(s -> parseCoordinates(s.getCoordinates()) == null)
                .forEach(s -> issues.add(new PackageIssue("COORDINATES_REQUIRED", SECTION, s.getId(), "coordinates",
                        "Не указаны координаты (широта, долгота) источника № " + nz(s.getCode()))));
        return issues;
    }

    /** The table's lines, one per source and substance, ordered by site, source and substance code. */
    @Transactional(readOnly = true)
    public List<EmissionLine> lines(PekReport report) {
        Map<Long, PekEmissionSource> byId = sourcesById(report.getProgramId());
        Map<String, PekReportEmissionBalance> balanceByKey = balances.findByReportId(report.getId()).stream()
                .collect(Collectors.toMap(b -> key(b.getEmissionSourceId(), b.getSubstanceCode()),
                        Function.identity(), (a, b) -> a));

        Map<String, List<PekReportResultRow>> grouped = new LinkedHashMap<>();
        for (PekReportResultRow r : emissionRows(report.getId())) {
            if (r.getEmissionSourceId() == null || isBlank(r.getIndicatorCode())) continue;
            grouped.computeIfAbsent(key(r.getEmissionSourceId(), r.getIndicatorCode()), k -> new ArrayList<>()).add(r);
        }

        List<EmissionLine> lines = new ArrayList<>();
        for (List<PekReportResultRow> group : grouped.values()) {
            PekReportResultRow first = group.getFirst();
            PekEmissionSource source = byId.get(first.getEmissionSourceId());
            if (source == null) continue;
            // Several measurements of one substance in a quarter: the г/с normative and the peak
            // г/с are single values (max), the period's tonnage is the sum of what each measurement
            // covers; т/год is the collect()-computed annual figure, the largest if they differ.
            BigDecimal actualQuarter = sum(group, PekReportResultRow::getActualTonsQuarter);
            PekReportEmissionBalance balance = balanceByKey.get(key(source.getId(), first.getIndicatorCode()));
            BigDecimal withoutTreatment = balance == null ? null : balance.getWithoutTreatmentTons();
            BigDecimal captured = balance == null ? null : balance.getCapturedTons();
            BigDecimal efficiency = source.getCleaningEfficiencyPercent();
            if (actualQuarter != null && efficiency != null && efficiency.signum() > 0
                    && efficiency.compareTo(BigDecimal.valueOf(100)) < 0) {
                if (withoutTreatment == null) {
                    withoutTreatment = actualQuarter.multiply(BigDecimal.valueOf(100))
                            .divide(BigDecimal.valueOf(100).subtract(efficiency), 6, RoundingMode.HALF_UP);
                }
                if (captured == null) {
                    captured = withoutTreatment.subtract(actualQuarter).max(BigDecimal.ZERO);
                }
            }
            BigDecimal[] coords = parseCoordinates(source.getCoordinates());
            lines.add(new EmissionLine(source.getId(), source.getWorkshopName(), source.getCode(), source.getName(),
                    first.getIndicatorCode(), first.getIndicatorName(),
                    max(group, PekReportResultRow::getNormativeGs), max(group, PekReportResultRow::getNormativeTonsYear),
                    max(group, PekReportResultRow::getActualGs), actualQuarter,
                    max(group, PekReportResultRow::getActualTonsYear),
                    withoutTreatment, captured, balance == null ? null : balance.getUtilizedTons(),
                    balance == null ? null : balance.getIncreaseReason(),
                    coords == null ? null : coords[0], coords == null ? null : coords[1]));
        }
        lines.sort(Comparator.comparing((EmissionLine l) -> nz(l.site()))
                .thenComparing(l -> nz(l.sourceCode()))
                .thenComparing(l -> nz(l.substanceCode())));
        return lines;
    }

    @Transactional
    public PekReportDocumentVersion generate(Long reportId, Long userId) {
        PekReport report = store.lockForGeneration(reportId);
        packagePolicy.requireCanGenerate(report);
        PekProgram program = programs.findById(report.getProgramId())
                .orElseThrow(() -> new NotFoundException("Программа ПЭК не найдена"));
        PekReportDocumentStore.requireNoIssues(issues(report), "ПЭК Выбросы (XLSX)");
        List<EmissionLine> lines = lines(report);
        Company company = companies.findById(report.getCompanyId()).orElse(null);
        String title = (company == null ? "" : company.getName() + " · ") + periodLabel(report);
        byte[] xlsx = render(title, lines);
        return store.store(report, program, PekReportDocumentType.EMISSIONS_XLSX, lines,
                new PekReportDocumentStore.Rendered(null, null, xlsx), "pek-emissions", userId);
    }

    /** Renders the sheet. Numbers are numeric cells, derived columns are formulas. */
    static byte[] render(String subtitle, List<EmissionLine> lines) {
        try (XSSFWorkbook book = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = book.createSheet(SHEET_NAME);
            Styles st = new Styles(book);

            Row titleRow = sheet.createRow(0);
            text(titleRow, 0, "Выбросы загрязняющих веществ в атмосферный воздух от стационарных источников", st.title);
            sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, HEADERS.size() - 1));
            Row subtitleRow = sheet.createRow(1);
            text(subtitleRow, 0, subtitle, st.subtitle);
            sheet.addMergedRegion(new CellRangeAddress(1, 1, 0, HEADERS.size() - 1));

            Row header = sheet.createRow(HEADER_ROW);
            header.setHeightInPoints(48);
            for (int c = 0; c < HEADERS.size(); c++) {
                text(header, c, HEADERS.get(c), st.header);
            }

            int r = HEADER_ROW + 1;
            for (EmissionLine l : lines) {
                Row row = sheet.createRow(r);
                text(row, 0, l.site(), st.text);
                text(row, 1, l.sourceCode(), st.text);
                text(row, 2, l.sourceName(), st.text);
                text(row, 3, l.substanceCode(), st.text);
                text(row, 4, l.substanceName(), st.text);
                number(row, 5, l.normativeGs(), st.gs);
                number(row, 6, l.normativeTonsYear(), st.tons);
                number(row, 7, l.actualGs(), st.gs);
                number(row, 8, l.actualTonsQuarter(), st.tons);
                number(row, 9, l.actualTonsYear(), st.tons);
                number(row, 10, l.withoutTreatmentTons(), st.tons);
                number(row, 11, l.capturedTons(), st.tons);
                number(row, 12, l.utilizedTons(), st.tons);
                String excelRow = String.valueOf(r + 1);
                String normTy = col(COL_NORM_TY) + excelRow;
                String actTy = col(COL_ACT_TY) + excelRow;
                formula(row, COL_OVER, "IF(OR(" + actTy + "=\"\"," + normTy + "=\"\"),\"\",MAX(0," + actTy + "-" + normTy + "))", st.tons);
                formula(row, COL_DEVIATION, "IF(OR(" + actTy + "=\"\"," + normTy + "=\"\"," + normTy + "=0),\"\",(" + actTy + "-" + normTy + ")/" + normTy + "*100)", st.percent);
                text(row, 15, l.increaseReason(), st.text);
                number(row, 16, l.latitude(), st.coordinate);
                number(row, 17, l.longitude(), st.coordinate);
                r++;
            }

            if (!lines.isEmpty()) {
                Row total = sheet.createRow(r);
                text(total, 0, "Итого", st.totalLabel);
                sheet.addMergedRegion(new CellRangeAddress(r, r, 0, 4));
                for (int c = 1; c <= 4; c++) text(total, c, null, st.totalLabel);
                String from = String.valueOf(HEADER_ROW + 2);
                String to = String.valueOf(r);
                for (int c = 5; c <= COL_OVER; c++) {
                    formula(total, c, "SUM(" + col(c) + from + ":" + col(c) + to + ")", c == 5 || c == 7 ? st.totalGs : st.totalTons);
                }
                for (int c = COL_DEVIATION; c < HEADERS.size(); c++) text(total, c, null, st.totalLabel);
            }

            for (int c = 0; c < WIDTHS.length; c++) {
                sheet.setColumnWidth(c, WIDTHS[c] * 256);
            }
            sheet.createFreezePane(3, HEADER_ROW + 1);
            sheet.setRepeatingRows(new CellRangeAddress(HEADER_ROW, HEADER_ROW, -1, -1));
            sheet.setAutoFilter(new CellRangeAddress(HEADER_ROW, Math.max(HEADER_ROW, r - 1), 0, HEADERS.size() - 1));
            PrintSetup print = sheet.getPrintSetup();
            print.setLandscape(true);
            print.setPaperSize(PrintSetup.A4_PAPERSIZE);
            print.setFitWidth((short) 1);
            print.setFitHeight((short) 0);
            sheet.setFitToPage(true);
            book.setForceFormulaRecalculation(true);
            book.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException("Не удалось сформировать XLSX выбросов ПЭК", e);
        }
    }

    private List<PekReportResultRow> emissionRows(Long reportId) {
        return resultRows.findByReportIdOrderBySectionTypeAscIndicatorNameAsc(reportId).stream()
                .filter(r -> EMISSION_TABLES.contains(r.getSectionType()))
                .toList();
    }

    private Map<Long, PekEmissionSource> sourcesById(Long programId) {
        return sources.findByProgramIdOrderBySortOrderAscIdAsc(programId).stream()
                .collect(Collectors.toMap(PekEmissionSource::getId, Function.identity()));
    }

    /** "43.2567, 68.1234" (also ";" or space separated, comma decimals) -> [lat, lon]; null otherwise. */
    static BigDecimal[] parseCoordinates(String raw) {
        if (raw == null) return null;
        Matcher m = COORDINATES.matcher(raw.trim());
        if (!m.matches()) return null;
        BigDecimal lat = new BigDecimal(m.group(1).replace(',', '.'));
        BigDecimal lon = new BigDecimal(m.group(2).replace(',', '.'));
        if (lat.abs().compareTo(BigDecimal.valueOf(90)) > 0 || lon.abs().compareTo(BigDecimal.valueOf(180)) > 0) {
            return null;
        }
        return new BigDecimal[]{lat, lon};
    }

    private static String periodLabel(PekReport report) {
        return report.getPeriodType() == PekPeriodType.YEAR
                ? report.getReportYear() + " год"
                : report.getReportQuarter() + " квартал " + report.getReportYear() + " года";
    }

    private static String key(Long sourceId, String code) {
        return sourceId + "|" + (code == null ? "" : code.trim().toUpperCase());
    }

    private static BigDecimal max(List<PekReportResultRow> rows, Function<PekReportResultRow, BigDecimal> f) {
        return rows.stream().map(f).filter(Objects::nonNull).max(Comparator.naturalOrder()).orElse(null);
    }

    private static BigDecimal sum(List<PekReportResultRow> rows, Function<PekReportResultRow, BigDecimal> f) {
        List<BigDecimal> values = rows.stream().map(f).filter(Objects::nonNull).toList();
        return values.isEmpty() ? null : values.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private static String col(int index) {
        return org.apache.poi.ss.util.CellReference.convertNumToColString(index);
    }

    private static void text(Row row, int c, String value, CellStyle style) {
        Cell cell = row.createCell(c, CellType.STRING);
        if (value != null) cell.setCellValue(value);
        cell.setCellStyle(style);
    }

    private static void number(Row row, int c, BigDecimal value, CellStyle style) {
        Cell cell = row.createCell(c);
        if (value != null) cell.setCellValue(value.doubleValue());
        cell.setCellStyle(style);
    }

    private static void formula(Row row, int c, String formula, CellStyle style) {
        Cell cell = row.createCell(c);
        cell.setCellFormula(formula);
        cell.setCellStyle(style);
    }

    private static String nz(String s) {
        return s == null ? "" : s;
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    /** Cell styles, created once per workbook (Excel caps the number of distinct styles). */
    private static final class Styles {
        final CellStyle title, subtitle, header, text, gs, tons, percent, coordinate, totalLabel, totalGs, totalTons;

        Styles(XSSFWorkbook book) {
            Font bold = book.createFont();
            bold.setBold(true);
            Font big = book.createFont();
            big.setBold(true);
            big.setFontHeightInPoints((short) 13);

            title = book.createCellStyle();
            title.setFont(big);
            subtitle = book.createCellStyle();

            header = bordered(book);
            header.setFont(bold);
            header.setWrapText(true);
            header.setAlignment(HorizontalAlignment.CENTER);
            header.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
            header.setFillPattern(FillPatternType.SOLID_FOREGROUND);

            text = bordered(book);
            text.setWrapText(true);
            gs = numeric(book, "0.000000");
            tons = numeric(book, "0.000000");
            percent = numeric(book, "0.0");
            coordinate = numeric(book, "0.000000");

            totalLabel = bordered(book);
            totalLabel.setFont(bold);
            totalGs = numeric(book, "0.000000");
            totalGs.setFont(bold);
            totalTons = numeric(book, "0.000000");
            totalTons.setFont(bold);
        }

        private static CellStyle bordered(XSSFWorkbook book) {
            CellStyle s = book.createCellStyle();
            s.setBorderTop(BorderStyle.THIN);
            s.setBorderBottom(BorderStyle.THIN);
            s.setBorderLeft(BorderStyle.THIN);
            s.setBorderRight(BorderStyle.THIN);
            s.setVerticalAlignment(VerticalAlignment.TOP);
            return s;
        }

        private static CellStyle numeric(XSSFWorkbook book, String format) {
            CellStyle s = bordered(book);
            s.setDataFormat(book.createDataFormat().getFormat(format));
            s.setAlignment(HorizontalAlignment.RIGHT);
            return s;
        }
    }
}
