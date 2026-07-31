package kz.eco.protocol.calculation;

import kz.eco.auth.CurrentUser;
import kz.eco.common.ApiResponse;
import kz.eco.protocol.ProtocolResult;
import kz.eco.protocol.ProtocolResultResponseMapper;
import kz.eco.protocol.calculation.dto.ProtocolCalculationDtos;
import kz.eco.user.SecurityExpressions;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/protocols")
@PreAuthorize(SecurityExpressions.LAB_PROTOCOL)
public class ProtocolCalculationController {

    private final ProtocolCalculationService calculationService;
    private final MethodTemplateRepository methodTemplateRepo;
    private final MethodVariableRepository variableRepo;

    public ProtocolCalculationController(ProtocolCalculationService calculationService,
                                          MethodTemplateRepository methodTemplateRepo,
                                          MethodVariableRepository variableRepo) {
        this.calculationService = calculationService;
        this.methodTemplateRepo = methodTemplateRepo;
        this.variableRepo = variableRepo;
    }

    @GetMapping("/method-templates")
    public ApiResponse<List<ProtocolCalculationDtos.MethodTemplateResponse>> listMethodTemplates() {
        List<ProtocolCalculationDtos.MethodTemplateResponse> templates = methodTemplateRepo.findByActiveTrueOrderByNameAsc()
                .stream().map(t -> {
                    var vars = variableRepo.findByMethodTemplateIdOrderByDisplayOrderAsc(t.getId())
                            .stream().map(v -> new ProtocolCalculationDtos.MethodVariableResponse(
                                    v.getId(), v.getVariableKey(), v.getVariableLabel(), v.getUnit(),
                                    v.getType(), v.getRequired(), v.getMinValue(), v.getMaxValue(),
                                    v.getDefaultValue(), v.getDisplayOrder()))
                            .toList();
                    return new ProtocolCalculationDtos.MethodTemplateResponse(
                            t.getId(), t.getCode(), t.getName(), t.getProtocolTemplateCode(),
                            t.getPollutantCode(), t.getPollutantName(), t.getMethodDocument(),
                            t.getMeasurementUnit(), t.getResultUnit(), t.getFormulaExpression(),
                            t.getDecimalPlaces(), t.getActive(), vars);
                }).toList();
        return ApiResponse.ok(templates);
    }

    @GetMapping("/method-templates/{id}")
    public ApiResponse<ProtocolCalculationDtos.MethodTemplateResponse> getMethodTemplate(@PathVariable Long id) {
        MethodTemplate t = methodTemplateRepo.findById(id)
                .orElseThrow(() -> new kz.eco.common.exception.NotFoundException("Методика не найдена: " + id));
        var vars = variableRepo.findByMethodTemplateIdOrderByDisplayOrderAsc(t.getId())
                .stream().map(v -> new ProtocolCalculationDtos.MethodVariableResponse(
                        v.getId(), v.getVariableKey(), v.getVariableLabel(), v.getUnit(),
                        v.getType(), v.getRequired(), v.getMinValue(), v.getMaxValue(),
                        v.getDefaultValue(), v.getDisplayOrder()))
                .toList();
        return ApiResponse.ok(new ProtocolCalculationDtos.MethodTemplateResponse(
                t.getId(), t.getCode(), t.getName(), t.getProtocolTemplateCode(),
                t.getPollutantCode(), t.getPollutantName(), t.getMethodDocument(),
                t.getMeasurementUnit(), t.getResultUnit(), t.getFormulaExpression(),
                t.getDecimalPlaces(), t.getActive(), vars));
    }

    @GetMapping("/{protocolId}/results/{resultId}/raw-measurements")
    public ApiResponse<ProtocolCalculationDtos.RawMeasurementsResponse> getRawMeasurements(
            @PathVariable Long protocolId, @PathVariable Long resultId) {
        return ApiResponse.ok(calculationService.getRawMeasurements(protocolId, resultId));
    }

    @PostMapping("/{protocolId}/results/{resultId}/raw-measurements")
    public ApiResponse<ProtocolCalculationDtos.SaveRawMeasurementsResponse> saveRawMeasurements(
            @PathVariable Long protocolId, @PathVariable Long resultId,
            @RequestBody ProtocolCalculationDtos.SaveRawMeasurementsRequest request) {
        ProtocolResult result = calculationService.saveRawMeasurements(
                protocolId, resultId, request, CurrentUser.get().getId());
        return ApiResponse.ok(new ProtocolCalculationDtos.SaveRawMeasurementsResponse(
                ProtocolResultResponseMapper.toResponse(result)), "Сырые данные сохранены");
    }

    @PostMapping("/{protocolId}/results/{resultId}/calculate")
    public ApiResponse<ProtocolCalculationDtos.CalculationResultResponse> calculateResult(
            @PathVariable Long protocolId, @PathVariable Long resultId) {
        return ApiResponse.ok(calculationService.calculateResult(protocolId, resultId, CurrentUser.get().getId()));
    }

    @PostMapping("/{protocolId}/calculate")
    public ApiResponse<ProtocolCalculationDtos.ProtocolCalculationSummaryResponse> calculateProtocol(
            @PathVariable Long protocolId) {
        return ApiResponse.ok(calculationService.calculateProtocol(protocolId, CurrentUser.get().getId()));
    }

    @GetMapping("/{protocolId}/results/{resultId}/calculation-history")
    public ApiResponse<List<ProtocolCalculationDtos.CalculationHistoryResponse>> getCalculationHistory(
            @PathVariable Long protocolId, @PathVariable Long resultId) {
        return ApiResponse.ok(calculationService.getCalculationHistory(protocolId, resultId));
    }
}
