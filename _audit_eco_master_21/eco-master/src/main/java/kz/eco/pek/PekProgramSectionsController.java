package kz.eco.pek;

import kz.eco.auth.CurrentUser;
import kz.eco.common.ApiResponse;
import kz.eco.pek.dto.PekProgramSectionDtos.EmergencyProcedureDto;
import kz.eco.pek.dto.PekProgramSectionDtos.EmergencyProcedureRequest;
import kz.eco.pek.dto.PekProgramSectionDtos.InternalInspectionDto;
import kz.eco.pek.dto.PekProgramSectionDtos.InternalInspectionRequest;
import kz.eco.pek.dto.PekProgramSectionDtos.MeasurementQaDto;
import kz.eco.pek.dto.PekProgramSectionDtos.MeasurementQaRequest;
import kz.eco.pek.dto.PekProgramSectionDtos.MonitoringPointDto;
import kz.eco.pek.dto.PekProgramSectionDtos.MonitoringPointRequest;
import kz.eco.pek.dto.PekProgramSectionDtos.ResponsibilityDto;
import kz.eco.pek.dto.PekProgramSectionDtos.ResponsibilityRequest;
import kz.eco.user.User;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** The five Правила №250 program sections added in module fix item 4: monitoring points,
 *  internal inspections, measurement QA, emergency procedures, responsibility structure. GET is
 *  PEK_VIEW; every mutation is PEK_PROGRAM_EDIT + mandatory If-Match (module fix item 3) and
 *  tenant-scoped the same way as every other program sub-resource in {@link PekController}
 *  (requireProgramAccess before delegating). */
@RestController
@RequestMapping("/api/pek/programs/{programId}")
public class PekProgramSectionsController {

    private final PekProgramSectionsService service;
    private final PekAccessService accessService;
    private final PekProgramRepository programRepository;

    public PekProgramSectionsController(PekProgramSectionsService service, PekAccessService accessService,
                                         PekProgramRepository programRepository) {
        this.service = service;
        this.accessService = accessService;
        this.programRepository = programRepository;
    }

    private void requireProgramAccess(Long programId) {
        User user = CurrentUser.get();
        PekProgram program = programRepository.findById(programId)
                .orElseThrow(() -> new kz.eco.common.exception.NotFoundException("Программа ПЭК не найдена: " + programId));
        accessService.requireProgramAccess(user.getId(), user.getRole(), program);
    }

    // ---- monitoring points --------------------------------------------------------------------

    @PreAuthorize(PekSecurityExpressions.PEK_VIEW)
    @GetMapping("/monitoring/{monitoringId}/points")
    public ApiResponse<List<MonitoringPointDto>> listPoints(@PathVariable Long programId, @PathVariable Long monitoringId) {
        requireProgramAccess(programId);
        return ApiResponse.ok(service.listPoints(programId, monitoringId));
    }

    @PreAuthorize(PekSecurityExpressions.PEK_PROGRAM_EDIT)
    @PostMapping("/monitoring/{monitoringId}/points")
    public ApiResponse<MonitoringPointDto> createPoint(@PathVariable Long programId, @PathVariable Long monitoringId,
                                                        @RequestBody MonitoringPointRequest request) {
        requireProgramAccess(programId);
        return ApiResponse.ok(service.createPoint(programId, monitoringId, request), "Точка мониторинга добавлена");
    }

    @PreAuthorize(PekSecurityExpressions.PEK_PROGRAM_EDIT)
    @PutMapping("/monitoring/points/{id}")
    public ApiResponse<MonitoringPointDto> updatePoint(@PathVariable Long programId, @PathVariable Long id,
                                                        @RequestBody MonitoringPointRequest request,
                                                        @RequestHeader("If-Match") Long version) {
        requireProgramAccess(programId);
        return ApiResponse.ok(service.updatePoint(programId, id, request, version), "Точка мониторинга изменена");
    }

    @PreAuthorize(PekSecurityExpressions.PEK_PROGRAM_EDIT)
    @DeleteMapping("/monitoring/points/{id}")
    public ApiResponse<Void> deletePoint(@PathVariable Long programId, @PathVariable Long id,
                                          @RequestHeader("If-Match") Long version) {
        requireProgramAccess(programId);
        service.deletePoint(programId, id, version);
        return ApiResponse.ok(null, "Точка мониторинга удалена");
    }

    // ---- internal inspections -------------------------------------------------------------------

    @PreAuthorize(PekSecurityExpressions.PEK_VIEW)
    @GetMapping("/internal-inspections")
    public ApiResponse<List<InternalInspectionDto>> listInspections(@PathVariable Long programId) {
        requireProgramAccess(programId);
        return ApiResponse.ok(service.listInspections(programId));
    }

    @PreAuthorize(PekSecurityExpressions.PEK_PROGRAM_EDIT)
    @PostMapping("/internal-inspections")
    public ApiResponse<InternalInspectionDto> createInspection(@PathVariable Long programId,
                                                                 @RequestBody InternalInspectionRequest request) {
        requireProgramAccess(programId);
        return ApiResponse.ok(service.createInspection(programId, request), "Внутренняя проверка добавлена");
    }

    @PreAuthorize(PekSecurityExpressions.PEK_PROGRAM_EDIT)
    @PutMapping("/internal-inspections/{id}")
    public ApiResponse<InternalInspectionDto> updateInspection(@PathVariable Long programId, @PathVariable Long id,
                                                                 @RequestBody InternalInspectionRequest request,
                                                                 @RequestHeader("If-Match") Long version) {
        requireProgramAccess(programId);
        return ApiResponse.ok(service.updateInspection(programId, id, request, version), "Внутренняя проверка изменена");
    }

    @PreAuthorize(PekSecurityExpressions.PEK_PROGRAM_EDIT)
    @DeleteMapping("/internal-inspections/{id}")
    public ApiResponse<Void> deleteInspection(@PathVariable Long programId, @PathVariable Long id,
                                               @RequestHeader("If-Match") Long version) {
        requireProgramAccess(programId);
        service.deleteInspection(programId, id, version);
        return ApiResponse.ok(null, "Внутренняя проверка удалена");
    }

    // ---- measurement QA ---------------------------------------------------------------------

    @PreAuthorize(PekSecurityExpressions.PEK_VIEW)
    @GetMapping("/measurement-qa")
    public ApiResponse<List<MeasurementQaDto>> listQa(@PathVariable Long programId) {
        requireProgramAccess(programId);
        return ApiResponse.ok(service.listQa(programId));
    }

    @PreAuthorize(PekSecurityExpressions.PEK_PROGRAM_EDIT)
    @PostMapping("/measurement-qa")
    public ApiResponse<MeasurementQaDto> createQa(@PathVariable Long programId, @RequestBody MeasurementQaRequest request) {
        requireProgramAccess(programId);
        return ApiResponse.ok(service.createQa(programId, request), "Процедура QA добавлена");
    }

    @PreAuthorize(PekSecurityExpressions.PEK_PROGRAM_EDIT)
    @PutMapping("/measurement-qa/{id}")
    public ApiResponse<MeasurementQaDto> updateQa(@PathVariable Long programId, @PathVariable Long id,
                                                   @RequestBody MeasurementQaRequest request,
                                                   @RequestHeader("If-Match") Long version) {
        requireProgramAccess(programId);
        return ApiResponse.ok(service.updateQa(programId, id, request, version), "Процедура QA изменена");
    }

    @PreAuthorize(PekSecurityExpressions.PEK_PROGRAM_EDIT)
    @DeleteMapping("/measurement-qa/{id}")
    public ApiResponse<Void> deleteQa(@PathVariable Long programId, @PathVariable Long id,
                                       @RequestHeader("If-Match") Long version) {
        requireProgramAccess(programId);
        service.deleteQa(programId, id, version);
        return ApiResponse.ok(null, "Процедура QA удалена");
    }

    // ---- emergency procedures -----------------------------------------------------------------

    @PreAuthorize(PekSecurityExpressions.PEK_VIEW)
    @GetMapping("/emergency-procedures")
    public ApiResponse<List<EmergencyProcedureDto>> listEmergencyProcedures(@PathVariable Long programId) {
        requireProgramAccess(programId);
        return ApiResponse.ok(service.listEmergencyProcedures(programId));
    }

    @PreAuthorize(PekSecurityExpressions.PEK_PROGRAM_EDIT)
    @PostMapping("/emergency-procedures")
    public ApiResponse<EmergencyProcedureDto> createEmergencyProcedure(@PathVariable Long programId,
                                                                        @RequestBody EmergencyProcedureRequest request) {
        requireProgramAccess(programId);
        return ApiResponse.ok(service.createEmergencyProcedure(programId, request), "Процедура на случай ЧС добавлена");
    }

    @PreAuthorize(PekSecurityExpressions.PEK_PROGRAM_EDIT)
    @PutMapping("/emergency-procedures/{id}")
    public ApiResponse<EmergencyProcedureDto> updateEmergencyProcedure(@PathVariable Long programId, @PathVariable Long id,
                                                                        @RequestBody EmergencyProcedureRequest request,
                                                                        @RequestHeader("If-Match") Long version) {
        requireProgramAccess(programId);
        return ApiResponse.ok(service.updateEmergencyProcedure(programId, id, request, version), "Процедура на случай ЧС изменена");
    }

    @PreAuthorize(PekSecurityExpressions.PEK_PROGRAM_EDIT)
    @DeleteMapping("/emergency-procedures/{id}")
    public ApiResponse<Void> deleteEmergencyProcedure(@PathVariable Long programId, @PathVariable Long id,
                                                       @RequestHeader("If-Match") Long version) {
        requireProgramAccess(programId);
        service.deleteEmergencyProcedure(programId, id, version);
        return ApiResponse.ok(null, "Процедура на случай ЧС удалена");
    }

    // ---- responsibility structure --------------------------------------------------------------

    @PreAuthorize(PekSecurityExpressions.PEK_VIEW)
    @GetMapping("/responsibilities")
    public ApiResponse<List<ResponsibilityDto>> listResponsibilities(@PathVariable Long programId) {
        requireProgramAccess(programId);
        return ApiResponse.ok(service.listResponsibilities(programId));
    }

    @PreAuthorize(PekSecurityExpressions.PEK_PROGRAM_EDIT)
    @PostMapping("/responsibilities")
    public ApiResponse<ResponsibilityDto> createResponsibility(@PathVariable Long programId,
                                                                 @RequestBody ResponsibilityRequest request) {
        requireProgramAccess(programId);
        return ApiResponse.ok(service.createResponsibility(programId, request), "Роль добавлена в структуру ответственности");
    }

    @PreAuthorize(PekSecurityExpressions.PEK_PROGRAM_EDIT)
    @PutMapping("/responsibilities/{id}")
    public ApiResponse<ResponsibilityDto> updateResponsibility(@PathVariable Long programId, @PathVariable Long id,
                                                                 @RequestBody ResponsibilityRequest request,
                                                                 @RequestHeader("If-Match") Long version) {
        requireProgramAccess(programId);
        return ApiResponse.ok(service.updateResponsibility(programId, id, request, version), "Роль изменена");
    }

    @PreAuthorize(PekSecurityExpressions.PEK_PROGRAM_EDIT)
    @DeleteMapping("/responsibilities/{id}")
    public ApiResponse<Void> deleteResponsibility(@PathVariable Long programId, @PathVariable Long id,
                                                   @RequestHeader("If-Match") Long version) {
        requireProgramAccess(programId);
        service.deleteResponsibility(programId, id, version);
        return ApiResponse.ok(null, "Роль удалена из структуры ответственности");
    }
}
