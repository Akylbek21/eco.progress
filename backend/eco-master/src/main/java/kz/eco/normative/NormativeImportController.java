package kz.eco.normative;

import kz.eco.common.ApiResponse;
import kz.eco.normative.dto.NormativeImportDtos;
import kz.eco.normative.dto.Dsm32ImportResult;
import kz.eco.normative.dto.PhysicalFactorImportResult;
import kz.eco.normative.dsm32.Dsm32EnvironmentSafetyImportService;
import kz.eco.protocol.dto.ProtocolApiDtos;
import kz.eco.user.SecurityExpressions;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/normatives")
public class NormativeImportController {

    private final NormativeImportService importService;
    private final PollutantRepository pollutantRepo;
    private final NormativeDirectoryService directoryService;
    private final NormativeResourceImportService resourceImportService;
    private final PhysicalFactorExcelImportService physicalFactorImportService;
    private final Dsm32EnvironmentSafetyImportService dsm32ImportService;

    public NormativeImportController(NormativeImportService importService,
                                      PollutantRepository pollutantRepo,
                                      NormativeDirectoryService directoryService,
                                      NormativeResourceImportService resourceImportService,
                                      PhysicalFactorExcelImportService physicalFactorImportService,
                                      Dsm32EnvironmentSafetyImportService dsm32ImportService) {
        this.importService = importService;
        this.pollutantRepo = pollutantRepo;
        this.directoryService = directoryService;
        this.resourceImportService = resourceImportService;
        this.physicalFactorImportService = physicalFactorImportService;
        this.dsm32ImportService = dsm32ImportService;
    }

    @PostMapping("/dsm32/import-resources")
    @PreAuthorize(SecurityExpressions.ADMIN_ONLY)
    public ApiResponse<Dsm32ImportResult> importDsm32() throws IOException {
        Long userId = kz.eco.auth.CurrentUser.get().getId();
        return ApiResponse.ok(dsm32ImportService.importResources(userId), "Импорт ДСМ-32 выполнен");
    }

    @PostMapping("/physical-factors/import-resources")
    @PreAuthorize(SecurityExpressions.ADMIN_ONLY)
    public ApiResponse<PhysicalFactorImportResult> importPhysicalFactors() throws IOException {
        Long userId = kz.eco.auth.CurrentUser.get().getId();
        return ApiResponse.ok(physicalFactorImportService.importResources(userId), "Импорт физических факторов ДСМ-15 выполнен");
    }

    @PostMapping("/import-resources")
    @PreAuthorize(SecurityExpressions.ADMIN_ONLY)
    public ApiResponse<NormativeResourceImportService.ImportResourcesResult> importResources(
            @RequestParam String sourceDocumentCode) throws IOException {
        return ApiResponse.ok(resourceImportService.importResources(sourceDocumentCode), "Импорт ресурсов выполнен");
    }

    @PostMapping(value = "/import/preview", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize(SecurityExpressions.ADMIN_ONLY)
    public ApiResponse<NormativeImportDtos.ImportPreviewResponse> importPreview(@RequestPart("file") MultipartFile file) throws IOException {
        return ApiResponse.ok(importService.previewImport(file));
    }

    @PostMapping(value = "/import/confirm", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize(SecurityExpressions.ADMIN_ONLY)
    public ApiResponse<NormativeImportDtos.ImportConfirmResponse> importConfirm(
            @RequestParam Long importId,
            @RequestPart("file") MultipartFile file) throws IOException {
        return ApiResponse.ok(importService.confirmImport(importId, file), "Импорт подтверждён");
    }

    @PostMapping("/imports/{id}/rollback")
    @PreAuthorize(SecurityExpressions.ADMIN_ONLY)
    public ApiResponse<String> rollback(@PathVariable Long id) {
        importService.rollbackImport(id);
        return ApiResponse.ok("Импорт отменён", "Импорт откачен");
    }

    @GetMapping("/resolve")
    @PreAuthorize(SecurityExpressions.LAB_PROTOCOL)
    public ApiResponse<NormativeImportDtos.NormativeResolveResponse> resolve(
            @RequestParam String templateType,
            @RequestParam String pollutantCode,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ApiResponse.ok(importService.resolve(templateType, pollutantCode, date));
    }

    @GetMapping("/pollutants")
    @PreAuthorize(SecurityExpressions.LAB_PROTOCOL)
    public ApiResponse<List<PollutantDto>> listPollutants() {
        return ApiResponse.ok(pollutantRepo.findByActiveTrueOrderByCodeAsc().stream()
                .map(p -> new PollutantDto(p.getId(), p.getCode(), p.getNameRu(), p.getCasNumber(), p.getHazardClass()))
                .toList());
    }

    @GetMapping("/source-documents")
    @PreAuthorize(SecurityExpressions.LAB_PROTOCOL)
    public ApiResponse<List<SourceDocumentDto>> sourceDocuments() {
        return ApiResponse.ok(List.of(
                new SourceDocumentDto(SourceDocumentCode.DSM_70.name(),
                        "Атмосферный воздух и воздух рабочей зоны", EnvironmentType.ATMOSPHERIC_AIR.name()),
                new SourceDocumentDto(SourceDocumentCode.DSM_32.name(),
                        "Безопасность среды обитания (почва)", EnvironmentType.SOIL.name()),
                new SourceDocumentDto(SourceDocumentCode.DSM_15.name(),
                        "Физические факторы, воздействующие на человека", null),
                new SourceDocumentDto(SourceDocumentCode.DSM_138.name(),
                        "Вода: хозяйственно-питьевое и культурно-бытовое водопользование", EnvironmentType.WATER.name())
        ));
    }

    record SourceDocumentDto(String code, String title, String environmentType) {
    }

    @GetMapping("/records")
    @PreAuthorize(SecurityExpressions.LAB_PROTOCOL)
    public ApiResponse<Map<String, Object>> listRecords(
            @RequestParam(required = false) String templateType,
            @RequestParam(required = false) String templateId,
            @RequestParam(required = false) String pollutantCode,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String query,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String indicator,
            @RequestParam(required = false) String indicatorName,
            @RequestParam(required = false) String subtype,
            @RequestParam(required = false) String normativeSubType,
            @RequestParam(required = false) String unit,
            @RequestParam(required = false) String environmentType,
            @RequestParam(required = false) String normativeType,
            @RequestParam(required = false) Boolean active,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size,
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
            @RequestParam(required = false) Integer appendixNo,
            @RequestParam(required = false) Integer tableNo,
            @RequestParam(required = false) String categoryCode,
            @RequestParam(required = false) String waterType,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String formType) {
        NormativeDirectoryService.NormativeQuery normativeQuery = NormativeDirectoryService.NormativeQuery.fromExtendedParams(
                templateType,
                templateId,
                pollutantCode != null ? pollutantCode : code,
                indicator != null ? indicator : indicatorName,
                subtype,
                unit,
                objectId,
                date != null ? date.toString() : null,
                environmentType,
                normativeType,
                normativeSubType,
                active,
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
                status,
                page,
                size,
                categoryCode,
                waterType,
                search, query, q, code, pollutantCode, indicator, indicatorName
        ).withCategoryAndFormType(category, formType);
        return ApiResponse.ok(directoryService.listRecords(normativeQuery), "OK");
    }

    record PollutantDto(Long id, String code, String nameRu, String casNumber, String hazardClass) {}
}
