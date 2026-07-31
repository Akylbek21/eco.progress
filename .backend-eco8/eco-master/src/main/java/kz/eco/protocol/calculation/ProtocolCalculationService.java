package kz.eco.protocol.calculation;

import kz.eco.common.exception.BadRequestException;
import kz.eco.common.exception.NotFoundException;
import kz.eco.protocol.*;

import static kz.eco.protocol.ProtocolMutationAction.CALCULATE;
import static kz.eco.protocol.ProtocolMutationAction.SAVE_RAW_MEASUREMENTS;
import kz.eco.protocol.calculation.dto.ProtocolCalculationDtos;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.*;

@Service
public class ProtocolCalculationService {

    private final ProtocolRepository protocolRepository;
    private final ProtocolTemplateRepository templateRepository;
    private final ProtocolResultRepository resultRepository;
    private final MethodTemplateRepository methodTemplateRepo;
    private final MethodVariableRepository variableRepo;
    private final RawMeasurementRepository rawMeasurementRepo;
    private final CalculationRunRepository calculationRunRepo;
    private final RepeatabilityRuleRepository repeatabilityRepo;
    private final UncertaintyRuleRepository uncertaintyRepo;
    private final FormulaEvaluator formulaEvaluator;
    private final ProtocolNormativeCheckService normativeCheckService;
    private final ProtocolMutationGuard mutationGuard;

    public ProtocolCalculationService(ProtocolRepository protocolRepository,
                                       ProtocolTemplateRepository templateRepository,
                                       ProtocolResultRepository resultRepository,
                                       MethodTemplateRepository methodTemplateRepo,
                                       MethodVariableRepository variableRepo,
                                       RawMeasurementRepository rawMeasurementRepo,
                                       CalculationRunRepository calculationRunRepo,
                                       RepeatabilityRuleRepository repeatabilityRepo,
                                       UncertaintyRuleRepository uncertaintyRepo,
                                       FormulaEvaluator formulaEvaluator,
                                       ProtocolNormativeCheckService normativeCheckService,
                                       ProtocolMutationGuard mutationGuard) {
        this.protocolRepository = protocolRepository;
        this.templateRepository = templateRepository;
        this.resultRepository = resultRepository;
        this.methodTemplateRepo = methodTemplateRepo;
        this.variableRepo = variableRepo;
        this.rawMeasurementRepo = rawMeasurementRepo;
        this.calculationRunRepo = calculationRunRepo;
        this.repeatabilityRepo = repeatabilityRepo;
        this.uncertaintyRepo = uncertaintyRepo;
        this.formulaEvaluator = formulaEvaluator;
        this.normativeCheckService = normativeCheckService;
        this.mutationGuard = mutationGuard;
    }

    @Transactional
    public ProtocolResult saveRawMeasurements(Long protocolId, Long resultId,
                                     ProtocolCalculationDtos.SaveRawMeasurementsRequest request, Long userId) {
        if (request == null || request.measurements() == null) {
            throw new BadRequestException("Не переданы исходные данные");
        }

        Protocol protocol = protocolRepository.findById(protocolId)
                .orElseThrow(() -> new NotFoundException("Протокол не найден"));
        ProtocolResult result = getResultOrThrow(protocolId, resultId);
        mutationGuard.requireEditable(protocol, SAVE_RAW_MEASUREMENTS);

        if (request.methodTemplateId() != null) {
            result.setMethodTemplateId(request.methodTemplateId());
            resultRepository.save(result);
        }

        for (var m : request.measurements()) {
            Optional<RawMeasurement> existing = rawMeasurementRepo
                    .findByProtocolResultIdAndVariableKey(resultId, m.variableKey());
            RawMeasurement raw;
            if (existing.isPresent()) {
                raw = existing.get();
            } else {
                raw = new RawMeasurement();
                raw.setProtocolResultId(resultId);
                raw.setVariableKey(m.variableKey());
            }
            raw.setVariableValue(m.variableValue());
            raw.setUnit(m.unit());
            raw.setSourceType(m.sourceType() != null ? m.sourceType() : "MANUAL");
            raw.setDeviceId(m.deviceId());
            rawMeasurementRepo.save(raw);
        }
        resultRepository.save(result);
        return resultRepository.findById(resultId).orElse(result);
    }

    @Transactional(readOnly = true)
    public ProtocolCalculationDtos.RawMeasurementsResponse getRawMeasurements(Long protocolId, Long resultId) {
        ProtocolResult result = getResultOrThrow(protocolId, resultId);
        MethodTemplate template = resolveMethodTemplate(result, protocolId);

        List<ProtocolCalculationDtos.MethodVariableResponse> variables = List.of();
        ProtocolCalculationDtos.MethodTemplateResponse templateResponse = null;

        if (template != null) {
            variables = variableRepo.findByMethodTemplateIdOrderByDisplayOrderAsc(template.getId())
                    .stream().map(this::toVariableResponse).toList();
            templateResponse = toTemplateResponse(template, variables);
        }

        List<RawMeasurement> measurements = rawMeasurementRepo.findByProtocolResultId(resultId);
        List<ProtocolCalculationDtos.RawMeasurementEntry> entries = measurements.stream()
                .map(m -> new ProtocolCalculationDtos.RawMeasurementEntry(
                        m.getId(), m.getVariableKey(), m.getVariableValue(), m.getUnit(), m.getSourceType()))
                .toList();

        return new ProtocolCalculationDtos.RawMeasurementsResponse(
                protocolId, resultId, templateResponse, variables, entries,
                result.getCalculationStatus(), result.getCalculationMessage());
    }

    @Transactional
    public ProtocolCalculationDtos.CalculationResultResponse calculateResult(Long protocolId, Long resultId, Long userId) {
        ProtocolResult result = getResultOrThrow(protocolId, resultId);
        Protocol protocol = protocolRepository.findById(protocolId)
                .orElseThrow(() -> new NotFoundException("Протокол не найден"));
        mutationGuard.requireEditable(protocol, CALCULATE);

        MethodTemplate template = resolveMethodTemplate(result, protocolId);
        List<String> warnings = new ArrayList<>();

        if (template == null) {
            return handleManualMode(result, protocol, userId, warnings);
        }

        List<MethodVariable> variables = variableRepo.findByMethodTemplateIdOrderByDisplayOrderAsc(template.getId());
        List<RawMeasurement> rawData = rawMeasurementRepo.findByProtocolResultId(resultId);
        Map<String, BigDecimal> inputMap = new LinkedHashMap<>();
        List<String> missing = new ArrayList<>();

        for (MethodVariable v : variables) {
            Optional<RawMeasurement> raw = rawData.stream()
                    .filter(r -> r.getVariableKey().equals(v.getVariableKey())).findFirst();
            if (raw.isPresent() && raw.get().getVariableValue() != null) {
                inputMap.put(v.getVariableKey(), raw.get().getVariableValue());
            } else if (v.getDefaultValue() != null) {
                inputMap.put(v.getVariableKey(), v.getDefaultValue());
            } else if (Boolean.TRUE.equals(v.getRequired())) {
                missing.add(v.getVariableLabel());
            }
        }

        if (!missing.isEmpty()) {
            result.setCalculationStatus(CalculationStatus.WAITING_INPUTS.name());
            result.setCalculationMessage("Не заполнено: " + String.join(", ", missing));
            resultRepository.save(result);
            saveCalculationRun(protocol, result, template, inputMap, null, null, null, null,
                    CalculationStatus.WAITING_INPUTS.name(), warnings, userId);
            return buildResponse(protocolId, result, warnings);
        }

        int decimalPlaces = template.getDecimalPlaces() != null ? template.getDecimalPlaces() : 3;
        RoundingMode roundingMode = parseRoundingMode(template.getRoundingMode());

        BigDecimal calculatedValue = formulaEvaluator.evaluate(
                template.getFormulaExpression(), inputMap, decimalPlaces, roundingMode);

        BigDecimal averageValue = calculateAverage(inputMap, calculatedValue, decimalPlaces, roundingMode);
        BigDecimal finalResult = averageValue != null ? averageValue : calculatedValue;

        if (averageValue != null) {
            String repeatWarning = checkRepeatability(template.getId(), inputMap, averageValue);
            if (repeatWarning != null) {
                warnings.add(repeatWarning);
                result.setCalculationStatus(CalculationStatus.NEEDS_REPEAT.name());
                result.setCalculationMessage("Превышен предел повторяемости. Требуется повторный анализ.");
                result.setResultValue(finalResult);
                result.setCalculatedAt(LocalDateTime.now());
                result.setMethodTemplateId(template.getId());
                resultRepository.save(result);
                saveCalculationRun(protocol, result, template, inputMap, calculatedValue, averageValue,
                        null, finalResult, CalculationStatus.NEEDS_REPEAT.name(), warnings, userId);
                return buildResponse(protocolId, result, warnings);
            }
        }

        BigDecimal uncertaintyValue = calculateUncertainty(template.getId(), finalResult);
        result.setResultValue(finalResult);
        result.setUncertaintyValue(uncertaintyValue);
        result.setMethodTemplateId(template.getId());
        result.setCalculationStatus(CalculationStatus.CALCULATED.name());
        result.setCalculationMessage(null);
        result.setCalculatedAt(LocalDateTime.now());

        applyResultUnit(result, finalResult, template.getResultUnit());

        normativeCheckService.applyNormativeToResult(result,
                getTemplateCode(protocol), protocol.getObjectName(),
                protocol.getTestDate() != null ? protocol.getTestDate() : protocol.getProtocolDate());
        normativeCheckService.compareResult(result, warnings);
        resultRepository.save(result);

        saveCalculationRun(protocol, result, template, inputMap, calculatedValue, averageValue,
                uncertaintyValue, finalResult, CalculationStatus.CALCULATED.name(), warnings, userId);

        return buildResponse(protocolId, result, warnings);
    }

    @Transactional
    public ProtocolCalculationDtos.ProtocolCalculationSummaryResponse calculateProtocol(Long protocolId, Long userId) {
        Protocol protocol = protocolRepository.findById(protocolId)
                .orElseThrow(() -> new NotFoundException("Протокол не найден"));
        mutationGuard.requireEditable(protocol, CALCULATE);

        List<ProtocolResult> results = resultRepository.findByProtocolIdOrderByRowNumberAsc(protocolId);
        List<ProtocolCalculationDtos.CalculationResultResponse> rows = new ArrayList<>();
        int calculated = 0, manual = 0, waitingInputs = 0, needsRepeat = 0, normativeNotFound = 0, errors = 0, exceeded = 0, complies = 0;

        for (ProtocolResult r : results) {
            try {
                ProtocolCalculationDtos.CalculationResultResponse resp = calculateResult(protocolId, r.getId(), userId);
                rows.add(resp);
                switch (resp.calculationStatus() != null ? resp.calculationStatus() : "") {
                    case "CALCULATED" -> calculated++;
                    case "MANUAL" -> manual++;
                    case "WAITING_INPUTS" -> waitingInputs++;
                    case "NEEDS_REPEAT" -> needsRepeat++;
                    case "NORMATIVE_NOT_FOUND" -> normativeNotFound++;
                    default -> {}
                }
                if ("EXCEEDED".equals(resp.internalStatus())) exceeded++;
                if ("NORMAL".equals(resp.internalStatus())) complies++;
            } catch (Exception e) {
                errors++;
                rows.add(new ProtocolCalculationDtos.CalculationResultResponse(
                        protocolId, r.getId(), null, null, null, null,
                        CalculationStatus.ERROR.name(), e.getMessage(), List.of(e.getMessage()), null));
            }
        }

        return new ProtocolCalculationDtos.ProtocolCalculationSummaryResponse(
                protocolId, results.size(), calculated, manual, waitingInputs,
                needsRepeat, normativeNotFound, errors, exceeded, complies, rows);
    }

    @Transactional(readOnly = true)
    public List<ProtocolCalculationDtos.CalculationHistoryResponse> getCalculationHistory(Long protocolId, Long resultId) {
        getResultOrThrow(protocolId, resultId);
        return calculationRunRepo.findByProtocolResultIdOrderByCreatedAtDesc(resultId).stream()
                .map(run -> new ProtocolCalculationDtos.CalculationHistoryResponse(
                        run.getId(), run.getInputJson(), run.getFormulaExpression(),
                        run.getCalculatedValue(), run.getAverageValue(), run.getUncertaintyValue(),
                        run.getFinalResult(), run.getNormativeValue(), run.getComplianceStatus(),
                        run.getStatus(), run.getWarningsJson(),
                        run.getCreatedAt() != null ? run.getCreatedAt().toString() : null, run.getCreatedBy()))
                .toList();
    }

    private ProtocolCalculationDtos.CalculationResultResponse handleManualMode(
            ProtocolResult result, Protocol protocol, Long userId, List<String> warnings) {
        result.setCalculationStatus(CalculationStatus.MANUAL.name());
        result.setCalculationMessage("Методика расчёта не настроена. Результат введён вручную.");

        BigDecimal existingValue = normativeCheckService.resolveComparableValue(result);
        if (existingValue != null) {
            normativeCheckService.applyNormativeToResult(result,
                    getTemplateCode(protocol), protocol.getObjectName(),
                    protocol.getTestDate() != null ? protocol.getTestDate() : protocol.getProtocolDate());
            normativeCheckService.compareResult(result, warnings);
        }
        resultRepository.save(result);

        saveCalculationRun(protocol, result, null, Map.of(), null, null, null,
                existingValue, CalculationStatus.MANUAL.name(), warnings, userId);

        return buildResponse(protocol.getId(), result, warnings);
    }

    private MethodTemplate resolveMethodTemplate(ProtocolResult result, Long protocolId) {
        if (result.getMethodTemplateId() != null) {
            return methodTemplateRepo.findById(result.getMethodTemplateId()).orElse(null);
        }
        Protocol protocol = protocolRepository.findById(protocolId).orElse(null);
        String templateCode = protocol != null ? getTemplateCode(protocol) : null;

        if (result.getPollutantCode() != null && templateCode != null) {
            Optional<MethodTemplate> byCode = methodTemplateRepo
                    .findFirstByPollutantCodeAndProtocolTemplateCodeAndActiveTrue(result.getPollutantCode(), templateCode);
            if (byCode.isPresent()) return byCode.get();
        }
        if (result.getIndicatorName() != null && templateCode != null) {
            Optional<MethodTemplate> byName = methodTemplateRepo
                    .findFirstByPollutantNameAndProtocolTemplateCodeAndActiveTrue(result.getIndicatorName(), templateCode);
            if (byName.isPresent()) return byName.get();
        }
        return null;
    }

    private BigDecimal calculateAverage(Map<String, BigDecimal> inputs, BigDecimal calculated,
                                         int decimalPlaces, RoundingMode roundingMode) {
        List<BigDecimal> parallels = new ArrayList<>();
        if (inputs.containsKey("parallel1") && inputs.get("parallel1") != null) parallels.add(inputs.get("parallel1"));
        if (inputs.containsKey("parallel2") && inputs.get("parallel2") != null) parallels.add(inputs.get("parallel2"));
        if (inputs.containsKey("parallel3") && inputs.get("parallel3") != null) parallels.add(inputs.get("parallel3"));

        if (parallels.isEmpty()) return null;
        parallels.add(calculated);
        BigDecimal sum = parallels.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        return sum.divide(BigDecimal.valueOf(parallels.size()), decimalPlaces, roundingMode);
    }

    private String checkRepeatability(Long methodTemplateId, Map<String, BigDecimal> inputs, BigDecimal average) {
        List<RepeatabilityRule> rules = repeatabilityRepo.findByMethodTemplateIdAndActiveTrue(methodTemplateId);
        if (rules.isEmpty()) return null;

        List<BigDecimal> parallels = new ArrayList<>();
        for (String key : List.of("parallel1", "parallel2", "parallel3")) {
            if (inputs.containsKey(key) && inputs.get(key) != null) parallels.add(inputs.get(key));
        }
        if (parallels.size() < 2) return null;

        BigDecimal maxVal = parallels.stream().max(BigDecimal::compareTo).orElse(BigDecimal.ZERO);
        BigDecimal minVal = parallels.stream().min(BigDecimal::compareTo).orElse(BigDecimal.ZERO);
        BigDecimal diff = maxVal.subtract(minVal);

        for (RepeatabilityRule rule : rules) {
            if (rule.getMaxDifferencePercent() != null && average.compareTo(BigDecimal.ZERO) != 0) {
                BigDecimal allowedDiff = average.abs().multiply(rule.getMaxDifferencePercent())
                        .divide(BigDecimal.valueOf(100), 6, RoundingMode.HALF_UP);
                if (diff.compareTo(allowedDiff) > 0) {
                    return rule.getMessage() != null ? rule.getMessage()
                            : "Превышен предел повторяемости (" + rule.getMaxDifferencePercent() + "%)";
                }
            }
        }
        return null;
    }

    private BigDecimal calculateUncertainty(Long methodTemplateId, BigDecimal result) {
        List<UncertaintyRule> rules = uncertaintyRepo.findByMethodTemplateIdAndActiveTrue(methodTemplateId);
        if (rules.isEmpty() || result == null) return null;

        for (UncertaintyRule rule : rules) {
            boolean inRange = true;
            if (rule.getConcentrationFrom() != null && result.compareTo(rule.getConcentrationFrom()) < 0) inRange = false;
            if (rule.getConcentrationTo() != null && result.compareTo(rule.getConcentrationTo()) > 0) inRange = false;
            if (!inRange) continue;

            if (rule.getAbsoluteUncertainty() != null) return rule.getAbsoluteUncertainty();
            if (rule.getUncertaintyPercent() != null) {
                return result.abs().multiply(rule.getUncertaintyPercent())
                        .divide(BigDecimal.valueOf(100), 6, RoundingMode.HALF_UP);
            }
        }
        return null;
    }

    private void applyResultUnit(ProtocolResult result, BigDecimal value, String resultUnit) {
        if (resultUnit == null) return;
        if (resultUnit.contains("мг/дм") || resultUnit.contains("мг/л")) {
            result.setResultMgDm3(value);
        } else if (resultUnit.contains("мг/м")) {
            result.setResultMgM3(value);
        }
    }

    private void saveCalculationRun(Protocol protocol, ProtocolResult result, MethodTemplate template,
                                     Map<String, BigDecimal> inputs, BigDecimal calculatedValue,
                                     BigDecimal averageValue, BigDecimal uncertaintyValue, BigDecimal finalResult,
                                     String status, List<String> warnings, Long userId) {
        CalculationRun run = new CalculationRun();
        run.setProtocolId(protocol.getId());
        run.setProtocolResultId(result.getId());
        run.setMethodTemplateId(template != null ? template.getId() : null);
        run.setInputJson(inputs.toString());
        run.setFormulaExpression(template != null ? template.getFormulaExpression() : null);
        run.setCalculatedValue(calculatedValue);
        run.setAverageValue(averageValue);
        run.setUncertaintyValue(uncertaintyValue);
        run.setFinalResult(finalResult);
        run.setNormativeValue(result.getNormativeValue());
        run.setComplianceStatus(result.getInternalStatus() != null ? result.getInternalStatus().name() : null);
        run.setStatus(status);
        run.setWarningsJson(warnings.isEmpty() ? null : warnings.toString());
        run.setCreatedBy(userId);
        calculationRunRepo.save(run);
    }

    private ProtocolCalculationDtos.CalculationResultResponse buildResponse(Long protocolId, ProtocolResult result, List<String> warnings) {
        return new ProtocolCalculationDtos.CalculationResultResponse(
                protocolId, result.getId(), result.getResultValue(), result.getUncertaintyValue(),
                result.getNormativeValue(),
                result.getInternalStatus() != null ? result.getInternalStatus().name() : null,
                result.getCalculationStatus(), result.getCalculationMessage(),
                warnings, ProtocolResultResponseMapper.toResponse(result));
    }

    private ProtocolResult getResultOrThrow(Long protocolId, Long resultId) {
        ProtocolResult result = resultRepository.findById(resultId)
                .orElseThrow(() -> new NotFoundException("Строка не найдена: " + resultId));
        if (!result.getProtocolId().equals(protocolId)) {
            throw new NotFoundException("Строка не принадлежит протоколу");
        }
        return result;
    }

    private String getTemplateCode(Protocol protocol) {
        if (protocol.getTemplateCode() != null && !protocol.getTemplateCode().isBlank()) {
            return protocol.getTemplateCode().trim().toLowerCase();
        }
        if (protocol.getTemplateId() == null) {
            return null;
        }
        return templateRepository.findById(protocol.getTemplateId())
                .map(t -> t.getCode().toLowerCase())
                .orElse(null);
    }

    private ProtocolCalculationDtos.MethodTemplateResponse toTemplateResponse(MethodTemplate t,
                                                                               List<ProtocolCalculationDtos.MethodVariableResponse> vars) {
        return new ProtocolCalculationDtos.MethodTemplateResponse(
                t.getId(), t.getCode(), t.getName(), t.getProtocolTemplateCode(),
                t.getPollutantCode(), t.getPollutantName(), t.getMethodDocument(),
                t.getMeasurementUnit(), t.getResultUnit(), t.getFormulaExpression(),
                t.getDecimalPlaces(), t.getActive(), vars);
    }

    private ProtocolCalculationDtos.MethodVariableResponse toVariableResponse(MethodVariable v) {
        return new ProtocolCalculationDtos.MethodVariableResponse(
                v.getId(), v.getVariableKey(), v.getVariableLabel(), v.getUnit(),
                v.getType(), v.getRequired(), v.getMinValue(), v.getMaxValue(),
                v.getDefaultValue(), v.getDisplayOrder());
    }

    private RoundingMode parseRoundingMode(String mode) {
        try {
            return mode != null ? RoundingMode.valueOf(mode) : RoundingMode.HALF_UP;
        } catch (IllegalArgumentException e) {
            return RoundingMode.HALF_UP;
        }
    }
}
