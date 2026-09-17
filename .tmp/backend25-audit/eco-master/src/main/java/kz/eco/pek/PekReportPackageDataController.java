package kz.eco.pek;

import kz.eco.auth.CurrentUser;
import kz.eco.common.ApiResponse;
import kz.eco.common.exception.NotFoundException;
import kz.eco.pek.dto.PekApiDtos;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Per-period inputs of the package documents that have no other home: execution of the program's
 * environmental measures and the balance columns of the emissions table. PUT replaces the listed
 * rows (rows not listed are left as they are); If-Match carries the REPORT version.
 */
@RestController
@RequestMapping("/api/pek/reports/{id}")
public class PekReportPackageDataController {

    private final PekReportPackageDataService service;
    private final PekReportRepository reports;
    private final PekAccessService access;

    public PekReportPackageDataController(PekReportPackageDataService service, PekReportRepository reports,
                                          PekAccessService access) {
        this.service = service;
        this.reports = reports;
        this.access = access;
    }

    @PreAuthorize(PekSecurityExpressions.PEK_VIEW)
    @GetMapping("/measure-executions")
    public ApiResponse<List<PekApiDtos.MeasureExecutionDto>> measureExecutions(@PathVariable Long id) {
        check(id);
        return ApiResponse.ok(service.measureExecutions(id));
    }

    @PreAuthorize(PekSecurityExpressions.PEK_REPORT_EDIT)
    @PutMapping("/measure-executions")
    public ApiResponse<List<PekApiDtos.MeasureExecutionDto>> saveMeasureExecutions(
            @PathVariable Long id, @RequestHeader(value = "If-Match", required = false) Long version,
            @RequestBody List<PekApiDtos.MeasureExecutionRequest> rows) {
        check(id);
        return ApiResponse.ok(service.saveMeasureExecutions(id, version, rows), "Выполнение мероприятий сохранено");
    }

    @PreAuthorize(PekSecurityExpressions.PEK_VIEW)
    @GetMapping("/emission-balances")
    public ApiResponse<List<PekApiDtos.EmissionBalanceDto>> emissionBalances(@PathVariable Long id) {
        check(id);
        return ApiResponse.ok(service.emissionBalances(id));
    }

    @PreAuthorize(PekSecurityExpressions.PEK_REPORT_EDIT)
    @PutMapping("/emission-balances")
    public ApiResponse<List<PekApiDtos.EmissionBalanceDto>> saveEmissionBalances(
            @PathVariable Long id, @RequestHeader(value = "If-Match", required = false) Long version,
            @RequestBody List<PekApiDtos.EmissionBalanceRequest> rows) {
        check(id);
        return ApiResponse.ok(service.saveEmissionBalances(id, version, rows), "Баланс выбросов сохранён");
    }

    private void check(Long id) {
        PekReport r = reports.findById(id).orElseThrow(() -> new NotFoundException("Отчёт ПЭК не найден: " + id));
        var u = CurrentUser.get();
        access.requireReportAccess(u.getId(), u.getRole(), r);
    }
}
