package kz.eco.journal;

import kz.eco.auth.CurrentUser;
import kz.eco.common.ApiResponse;
import kz.eco.journal.dto.LabJournalDtos.JournalEntryRequest;
import kz.eco.journal.dto.LabJournalDtos.JournalEntryResponse;
import kz.eco.journal.dto.LabJournalDtos.JournalTypeResponse;
import kz.eco.journal.dto.LabJournalDtos.PageResponse;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.io.ByteArrayInputStream;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/lab-journals")
@PreAuthorize(kz.eco.user.SecurityExpressions.LAB_JOURNALS)
public class LabJournalController {

    private final LabJournalService journalService;
    private final LabJournalExcelService excelService;

    public LabJournalController(LabJournalService journalService, LabJournalExcelService excelService) {
        this.journalService = journalService;
        this.excelService = excelService;
    }

    @GetMapping("/types")
    public ApiResponse<List<JournalTypeResponse>> types() {
        return ApiResponse.ok(journalService.listTypes());
    }

    @GetMapping("/entries")
    public ApiResponse<PageResponse<JournalEntryResponse>> entries(
            @RequestParam String journalType,
            @RequestParam(required = false, defaultValue = "0") Integer page,
            @RequestParam(required = false, defaultValue = "50") Integer size,
            @RequestParam(required = false) String dateFrom,
            @RequestParam(required = false) String dateTo,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Long laboratoryId) {
        return ApiResponse.ok(journalService.search(
                journalType, page, size, parseDate(dateFrom), parseDate(dateTo), search,
                laboratoryId, CurrentUser.get()));
    }

    @PostMapping("/entries")
    public ApiResponse<JournalEntryResponse> create(@RequestBody JournalEntryRequest request) {
        return ApiResponse.ok(journalService.create(request, CurrentUser.get()), "Запись добавлена");
    }

    @PutMapping("/entries/{id}")
    public ApiResponse<JournalEntryResponse> update(@PathVariable Long id, @RequestBody JournalEntryRequest request) {
        return ApiResponse.ok(journalService.update(id, request, CurrentUser.get()), "Запись обновлена");
    }

    @DeleteMapping("/entries/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        journalService.delete(id, CurrentUser.get());
        return ApiResponse.ok(null, "Запись удалена");
    }

    @GetMapping("/entries/export")
    public ResponseEntity<InputStreamResource> export(
            @RequestParam String journalType,
            @RequestParam(required = false) String dateFrom,
            @RequestParam(required = false) String dateTo,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Long laboratoryId) {
        JournalType type = JournalType.fromCode(journalType);
        List<LabJournalEntry> entries = journalService.findAllForExport(
                journalType, parseDate(dateFrom), parseDate(dateTo), search, laboratoryId, CurrentUser.get());
        List<Map<String, Object>> rows = entries.stream().map(journalService::readData).toList();
        byte[] content = excelService.export(type, rows, parseDate(dateFrom), parseDate(dateTo), laboratoryId);
        String filename = "journal_" + type.name() + "_" + LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE) + ".xlsx";
        return excelResponse(content, filename);
    }

    @GetMapping("/entries/export-template")
    public ResponseEntity<InputStreamResource> exportTemplate(
            @RequestParam String journalType,
            @RequestParam(required = false) Long laboratoryId) {
        JournalType type = JournalType.fromCode(journalType);
        byte[] content = excelService.exportEmptyTemplate(type, laboratoryId);
        String filename = "journal_template_" + type.name() + ".xlsx";
        return excelResponse(content, filename);
    }

    private ResponseEntity<InputStreamResource> excelResponse(byte[] content, String filename) {
        String encoded = URLEncoder.encode(filename, StandardCharsets.UTF_8).replace("+", "%20");
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + encoded)
                .body(new InputStreamResource(new ByteArrayInputStream(content)));
    }

    private LocalDate parseDate(String value) {
        return value == null || value.isBlank() ? null : LocalDate.parse(value.trim());
    }
}
