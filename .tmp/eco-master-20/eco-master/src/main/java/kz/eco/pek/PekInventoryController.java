package kz.eco.pek;

import kz.eco.auth.CurrentUser;
import kz.eco.common.ApiResponse;
import kz.eco.common.exception.NotFoundException;
import kz.eco.pek.dto.PekProgramSectionDtos.DischargeSourceDto;
import kz.eco.pek.dto.PekProgramSectionDtos.DischargeSourceRequest;
import kz.eco.pek.dto.PekProgramSectionDtos.EmissionSourceDto;
import kz.eco.pek.dto.PekProgramSectionDtos.EmissionSourceRequest;
import kz.eco.pek.dto.PekProgramSectionDtos.WasteItemDto;
import kz.eco.pek.dto.PekProgramSectionDtos.WasteItemRequest;
import kz.eco.pek.dto.PekProgramSectionDtos.WasteMovementDto;
import kz.eco.pek.dto.PekProgramSectionDtos.WasteMovementRequest;
import kz.eco.user.User;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * The subject-domain inventories behind the environmental tables of a PEK report: emission sources,
 * discharge outlets, and the waste catalogue (all program-scoped), plus per-period waste movements
 * (report-scoped).
 *
 * <p>Same access rules as every other PEK sub-resource: GET is PEK_VIEW, mutations are
 * PEK_PROGRAM_EDIT / PEK_REPORT_EDIT with mandatory If-Match, and every call is tenant-scoped
 * through {@link PekAccessService} before it reaches the service.
 */
@RestController
@RequestMapping("/api/pek")
public class PekInventoryController {

    private final PekInventoryService service;
    private final PekAccessService accessService;
    private final PekProgramRepository programRepository;
    private final PekReportRepository reportRepository;

    public PekInventoryController(PekInventoryService service, PekAccessService accessService,
                                  PekProgramRepository programRepository, PekReportRepository reportRepository) {
        this.service = service;
        this.accessService = accessService;
        this.programRepository = programRepository;
        this.reportRepository = reportRepository;
    }

    private void requireProgramAccess(Long programId) {
        User user = CurrentUser.get();
        PekProgram program = programRepository.findById(programId)
                .orElseThrow(() -> new NotFoundException("Программа ПЭК не найдена: " + programId));
        accessService.requireProgramAccess(user.getId(), user.getRole(), program);
    }

    private void requireReportAccess(Long reportId) {
        User user = CurrentUser.get();
        PekReport report = reportRepository.findById(reportId)
                .orElseThrow(() -> new NotFoundException("Отчёт ПЭК не найден: " + reportId));
        accessService.requireReportAccess(user.getId(), user.getRole(), report);
    }

    // ---- emission sources -------------------------------------------------------------------------

    @PreAuthorize(PekSecurityExpressions.PEK_VIEW)
    @GetMapping("/programs/{programId}/emission-sources")
    public ApiResponse<List<EmissionSourceDto>> listEmissionSources(@PathVariable Long programId) {
        requireProgramAccess(programId);
        return ApiResponse.ok(service.listEmissionSources(programId));
    }

    @PreAuthorize(PekSecurityExpressions.PEK_PROGRAM_EDIT)
    @PostMapping("/programs/{programId}/emission-sources")
    public ApiResponse<EmissionSourceDto> createEmissionSource(@PathVariable Long programId,
                                                               @RequestBody EmissionSourceRequest request) {
        requireProgramAccess(programId);
        return ApiResponse.ok(service.createEmissionSource(programId, request), "Источник выбросов добавлен");
    }

    @PreAuthorize(PekSecurityExpressions.PEK_PROGRAM_EDIT)
    @PutMapping("/programs/{programId}/emission-sources/{id}")
    public ApiResponse<EmissionSourceDto> updateEmissionSource(@PathVariable Long programId, @PathVariable Long id,
                                                               @RequestBody EmissionSourceRequest request,
                                                               @RequestHeader("If-Match") Long version) {
        requireProgramAccess(programId);
        return ApiResponse.ok(service.updateEmissionSource(programId, id, request, version), "Источник выбросов изменён");
    }

    @PreAuthorize(PekSecurityExpressions.PEK_PROGRAM_EDIT)
    @DeleteMapping("/programs/{programId}/emission-sources/{id}")
    public ApiResponse<Void> deleteEmissionSource(@PathVariable Long programId, @PathVariable Long id,
                                                  @RequestHeader("If-Match") Long version) {
        requireProgramAccess(programId);
        service.deleteEmissionSource(programId, id, version);
        return ApiResponse.ok(null, "Источник выбросов удалён");
    }

    // ---- discharge outlets ------------------------------------------------------------------------

    @PreAuthorize(PekSecurityExpressions.PEK_VIEW)
    @GetMapping("/programs/{programId}/discharge-sources")
    public ApiResponse<List<DischargeSourceDto>> listDischargeSources(@PathVariable Long programId) {
        requireProgramAccess(programId);
        return ApiResponse.ok(service.listDischargeSources(programId));
    }

    @PreAuthorize(PekSecurityExpressions.PEK_PROGRAM_EDIT)
    @PostMapping("/programs/{programId}/discharge-sources")
    public ApiResponse<DischargeSourceDto> createDischargeSource(@PathVariable Long programId,
                                                                 @RequestBody DischargeSourceRequest request) {
        requireProgramAccess(programId);
        return ApiResponse.ok(service.createDischargeSource(programId, request), "Выпуск сточных вод добавлен");
    }

    @PreAuthorize(PekSecurityExpressions.PEK_PROGRAM_EDIT)
    @PutMapping("/programs/{programId}/discharge-sources/{id}")
    public ApiResponse<DischargeSourceDto> updateDischargeSource(@PathVariable Long programId, @PathVariable Long id,
                                                                 @RequestBody DischargeSourceRequest request,
                                                                 @RequestHeader("If-Match") Long version) {
        requireProgramAccess(programId);
        return ApiResponse.ok(service.updateDischargeSource(programId, id, request, version), "Выпуск изменён");
    }

    @PreAuthorize(PekSecurityExpressions.PEK_PROGRAM_EDIT)
    @DeleteMapping("/programs/{programId}/discharge-sources/{id}")
    public ApiResponse<Void> deleteDischargeSource(@PathVariable Long programId, @PathVariable Long id,
                                                   @RequestHeader("If-Match") Long version) {
        requireProgramAccess(programId);
        service.deleteDischargeSource(programId, id, version);
        return ApiResponse.ok(null, "Выпуск удалён");
    }

    // ---- waste catalogue --------------------------------------------------------------------------

    @PreAuthorize(PekSecurityExpressions.PEK_VIEW)
    @GetMapping("/programs/{programId}/waste-items")
    public ApiResponse<List<WasteItemDto>> listWasteItems(@PathVariable Long programId) {
        requireProgramAccess(programId);
        return ApiResponse.ok(service.listWasteItems(programId));
    }

    @PreAuthorize(PekSecurityExpressions.PEK_PROGRAM_EDIT)
    @PostMapping("/programs/{programId}/waste-items")
    public ApiResponse<WasteItemDto> createWasteItem(@PathVariable Long programId,
                                                     @RequestBody WasteItemRequest request) {
        requireProgramAccess(programId);
        return ApiResponse.ok(service.createWasteItem(programId, request), "Вид отхода добавлен");
    }

    @PreAuthorize(PekSecurityExpressions.PEK_PROGRAM_EDIT)
    @PutMapping("/programs/{programId}/waste-items/{id}")
    public ApiResponse<WasteItemDto> updateWasteItem(@PathVariable Long programId, @PathVariable Long id,
                                                     @RequestBody WasteItemRequest request,
                                                     @RequestHeader("If-Match") Long version) {
        requireProgramAccess(programId);
        return ApiResponse.ok(service.updateWasteItem(programId, id, request, version), "Вид отхода изменён");
    }

    @PreAuthorize(PekSecurityExpressions.PEK_PROGRAM_EDIT)
    @DeleteMapping("/programs/{programId}/waste-items/{id}")
    public ApiResponse<Void> deleteWasteItem(@PathVariable Long programId, @PathVariable Long id,
                                             @RequestHeader("If-Match") Long version) {
        requireProgramAccess(programId);
        service.deleteWasteItem(programId, id, version);
        return ApiResponse.ok(null, "Вид отхода удалён");
    }

    // ---- waste movements for one reporting period --------------------------------------------------

    @PreAuthorize(PekSecurityExpressions.PEK_VIEW)
    @GetMapping("/reports/{reportId}/waste-movements")
    public ApiResponse<List<WasteMovementDto>> listWasteMovements(@PathVariable Long reportId) {
        requireReportAccess(reportId);
        return ApiResponse.ok(service.listWasteMovements(reportId));
    }

    /**
     * Upsert by (report, waste type): one row per waste type per period, so a repeated submission
     * for the same type updates that period's figures rather than creating a second, contradictory
     * row. If-Match is required when a row already exists and ignored when creating the first one.
     */
    @PreAuthorize(PekSecurityExpressions.PEK_REPORT_EDIT)
    @PostMapping("/reports/{reportId}/waste-movements")
    public ApiResponse<WasteMovementDto> upsertWasteMovement(@PathVariable Long reportId,
                                                             @RequestBody WasteMovementRequest request,
                                                             @RequestHeader(value = "If-Match", required = false) Long version) {
        requireReportAccess(reportId);
        return ApiResponse.ok(service.upsertWasteMovement(reportId, request, version), "Данные по отходу сохранены");
    }

    @PreAuthorize(PekSecurityExpressions.PEK_REPORT_EDIT)
    @DeleteMapping("/reports/{reportId}/waste-movements/{id}")
    public ApiResponse<Void> deleteWasteMovement(@PathVariable Long reportId, @PathVariable Long id,
                                                 @RequestHeader("If-Match") Long version) {
        requireReportAccess(reportId);
        service.deleteWasteMovement(reportId, id, version);
        return ApiResponse.ok(null, "Данные по отходу удалены");
    }
}
