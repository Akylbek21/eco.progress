package kz.eco.protocol;

import kz.eco.common.ApiResponse;
import kz.eco.common.SearchTextUtils;
import kz.eco.normative.NormativeManagementService;
import kz.eco.normative.NormativeSearchService;
import kz.eco.protocol.dto.ProtocolApiDtos;
import kz.eco.user.SecurityExpressions;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/normatives")
@PreAuthorize(SecurityExpressions.LAB_PROTOCOL)
public class NormativeReferenceController {

    private final NormativeReferenceService normativeService;
    private final NormativeSearchService normativeSearchService;
    private final NormativeManagementService normativeManagementService;
    private final NormativeExcelImportService importService;

    public NormativeReferenceController(NormativeReferenceService normativeService,
                                        NormativeSearchService normativeSearchService,
                                        NormativeManagementService normativeManagementService,
                                        NormativeExcelImportService importService) {
        this.normativeService = normativeService;
        this.normativeSearchService = normativeSearchService;
        this.normativeManagementService = normativeManagementService;
        this.importService = importService;
    }

    @GetMapping
    public ApiResponse<List<ProtocolApiDtos.NormativeRecord>> list(
            @RequestParam(required = false) String templateId,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String query,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String pollutantCode,
            @RequestParam(required = false) String indicator,
            @RequestParam(required = false) String indicatorName,
            @RequestParam(required = false) String sourceDocumentCode,
            @RequestParam(required = false) String factorType,
            @RequestParam(required = false) String factorCode,
            @RequestParam(required = false) String roomType,
            @RequestParam(required = false) String season,
            @RequestParam(required = false) String workCategory,
            @RequestParam(required = false) String workplaceType,
            @RequestParam(required = false) String normLevel,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Boolean active,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        return ApiResponse.ok(normativeSearchService.list(
                SearchTextUtils.firstNonBlank(query, q, search),
                q,
                code,
                pollutantCode,
                SearchTextUtils.firstNonBlank(indicator, indicatorName),
                templateId,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                sourceDocumentCode,
                factorType,
                factorCode,
                roomType,
                season,
                workCategory,
                workplaceType,
                normLevel,
                null,
                null,
                status,
                active,
                page,
                size));
    }

    private static final int DEFAULT_SEARCH_SIZE = 30;
    private static final int MAX_SEARCH_SIZE = 100;

    @GetMapping("/search")
    public ApiResponse<Map<String, Object>> search(
            @RequestParam(required = false) String query,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String pollutantCode,
            @RequestParam(required = false) String indicator,
            @RequestParam(required = false) String indicatorName,
            @RequestParam(required = false) String templateId,
            @RequestParam(required = false) String subtype,
            @RequestParam(required = false) String unit,
            @RequestParam(required = false) String environmentType,
            @RequestParam(required = false) String normativeType,
            @RequestParam(required = false) String normativeSubType,
            @RequestParam(required = false) String objectType,
            @RequestParam(required = false) Long objectId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) String sourceDocumentCode,
            @RequestParam(required = false) String factorType,
            @RequestParam(required = false) String factorCode,
            @RequestParam(required = false) String roomType,
            @RequestParam(required = false) String season,
            @RequestParam(required = false) String workCategory,
            @RequestParam(required = false) String workplaceType,
            @RequestParam(required = false) String normLevel,
            @RequestParam(required = false) String visualWorkCategory,
            @RequestParam(required = false) String lightingType,
            @RequestParam(required = false) String noiseType,
            @RequestParam(required = false) String categoryCode,
            @RequestParam(required = false) String waterType,
            @RequestParam(required = false) String waterUseCategory,
            @RequestParam(required = false) Integer appendixNo,
            @RequestParam(required = false) Integer tableNo,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Boolean active,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false, defaultValue = "false") boolean allowCrossContextFallback) {
        if (page != null && page < 0) {
            throw new kz.eco.common.exception.BadRequestException("page не может быть отрицательным");
        }
        if (size != null && size <= 0) {
            throw new kz.eco.common.exception.BadRequestException("size должен быть положительным числом");
        }
        if (templateId != null && !templateId.isBlank() && !kz.eco.normative.NormativeApiContract
                .CANONICAL_TEMPLATE_IDS.contains(kz.eco.normative.NormativeApiContract.normalizeTemplateId(templateId))) {
            throw new kz.eco.common.exception.BadRequestException("Неизвестный templateId: " + templateId);
        }
        int effectivePage = page != null ? page : 0;
        int effectiveSize = Math.min(size != null ? size : DEFAULT_SEARCH_SIZE, MAX_SEARCH_SIZE);
        String resolvedIndicator = SearchTextUtils.firstNonBlank(indicator, indicatorName);
        String resolvedEnvironment = SearchTextUtils.firstNonBlank(environmentType, objectType);
        String resolvedQuery = SearchTextUtils.firstNonBlank(query, q, search);
        // An empty query is only allowed when enough other context narrows the result set down
        // (templateId/sourceDocumentCode/factorType/categoryCode) - otherwise this would return
        // the entire directory a page at a time instead of nothing.
        boolean hasContext = anyNonBlank(templateId, sourceDocumentCode, factorType, categoryCode,
                code, pollutantCode, resolvedIndicator);
        if ((resolvedQuery == null || resolvedQuery.isBlank()) && !hasContext) {
            return ApiResponse.ok(emptySearchPayload(effectivePage, effectiveSize), "OK");
        }
        // A client-supplied allowCrossContextFallback is only honored for admins - broadening a
        // search across protocol types is a browsing convenience, not something a lab user's
        // protocol-creation search should ever silently opt into.
        boolean effectiveAllowCrossContextFallback = allowCrossContextFallback
                && kz.eco.auth.CurrentUser.get().getRole() == kz.eco.user.UserRole.ADMIN;
        return ApiResponse.ok(normativeSearchService.search(
                resolvedQuery,
                q,
                code,
                pollutantCode,
                resolvedIndicator,
                templateId,
                subtype,
                unit,
                objectId,
                date != null ? date.toString() : null,
                resolvedEnvironment,
                normativeType,
                normativeSubType,
                sourceDocumentCode,
                factorType,
                factorCode,
                roomType,
                season,
                workCategory,
                workplaceType,
                normLevel,
                appendixNo,
                tableNo,
                status != null ? status : "ACTIVE",
                active,
                effectivePage,
                effectiveSize,
                categoryCode,
                waterType,
                waterUseCategory,
                visualWorkCategory,
                lightingType,
                noiseType,
                effectiveAllowCrossContextFallback), "OK");
    }

    private static boolean anyNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return true;
            }
        }
        return false;
    }

    private static Map<String, Object> emptySearchPayload(int page, int size) {
        Map<String, Object> payload = new java.util.LinkedHashMap<>();
        payload.put("records", List.of());
        payload.put("normatives", List.of());
        payload.put("items", List.of());
        payload.put("results", List.of());
        payload.put("found", false);
        payload.put("ambiguous", false);
        payload.put("limited", false);
        payload.put("page", page);
        payload.put("size", size);
        payload.put("totalElements", 0);
        payload.put("totalPages", 0);
        payload.put("message", "Уточните запрос: укажите текст поиска или контекст (тип протокола, источник, категория).");
        return payload;
    }

    @PostMapping
    public ApiResponse<ProtocolApiDtos.NormativeRecord> create(@RequestBody ProtocolApiDtos.NormativeUpsertRequest request) {
        return ApiResponse.ok(normativeManagementService.create(request), "Норматив создан");
    }

    @PatchMapping("/{id}")
    public ApiResponse<ProtocolApiDtos.NormativeRecord> update(@PathVariable Long id,
                                                               @RequestBody ProtocolApiDtos.NormativeUpsertRequest request) {
        return ApiResponse.ok(normativeManagementService.update(id, request), "Норматив обновлён");
    }

    @PostMapping("/{id}/archive")
    public ApiResponse<ProtocolApiDtos.NormativeRecord> archive(@PathVariable Long id) {
        return ApiResponse.ok(normativeManagementService.archive(id), "Норматив архивирован");
    }

    @PostMapping("/bulk/archive")
    public ApiResponse<List<ProtocolApiDtos.NormativeRecord>> bulkArchive(@RequestBody BulkArchiveRequest request) {
        List<ProtocolApiDtos.NormativeRecord> archived = normativeManagementService.bulkArchive(
                request != null ? request.ids() : null);
        return ApiResponse.ok(archived, "Нормативы архивированы");
    }

    public record BulkArchiveRequest(List<Long> ids) {
    }

    @PostMapping(value = "/import-excel/preview", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<ProtocolApiDtos.NormativeImportPreviewResponse> importPreview(@RequestPart("file") MultipartFile file) throws Exception {
        return ApiResponse.ok(importService.preview(file));
    }

    @PostMapping(value = "/import-excel/confirm", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<List<ProtocolApiDtos.NormativeRecord>> importConfirm(@RequestPart("file") MultipartFile file) throws Exception {
        return ApiResponse.ok(importService.confirm(file), "Нормативы импортированы");
    }

    @PostMapping(value = "/import-excel", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<List<ProtocolApiDtos.NormativeRecord>> importExcel(@RequestPart("file") MultipartFile file) throws Exception {
        return ApiResponse.ok(importService.confirm(file), "Нормативы импортированы");
    }
}
