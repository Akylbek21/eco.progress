package kz.eco.protocol;

import kz.eco.common.exception.BadRequestException;
import kz.eco.common.exception.ConflictException;
import kz.eco.common.exception.NotFoundException;
import kz.eco.content.ContentVersioning;
import kz.eco.protocol.dto.ProtocolApiDtos;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * CRUD + bulk-copy for protocol sampling points.
 *
 * <p>Access control mirrors the result-row service: every mutation requires the caller to hold
 * at least assertCanEdit access on the protocol, and the protocol must be in an editable status
 * (DRAFT / CALCULATED / NEEDS_REVISION).  Sampling points belong to exactly one protocol;
 * the FK is enforced both at the DB level (FK with CASCADE DELETE) and here.
 *
 * <p>Delete behaviour: a point that still has results attached is rejected (409
 * SAMPLING_POINT_HAS_RESULTS). The caller must either delete or re-assign those results first.
 * This is intentional — silently orphaning results would break the AMBIENT_AIR_SZZ requirement
 * that every result must carry a valid spatial reference.
 */
@Service
public class ProtocolSamplingPointService {

    private final ProtocolRepository protocolRepository;
    private final ProtocolSamplingPointRepository pointRepository;
    private final ProtocolResultRepository resultRepository;
    private final ProtocolMutationGuard mutationGuard;
    private final ProtocolAccessService accessService;
    private final ProtocolAuditService auditService;
    private final ProtocolContentVersionService contentVersionService;

    public ProtocolSamplingPointService(
            ProtocolRepository protocolRepository,
            ProtocolSamplingPointRepository pointRepository,
            ProtocolResultRepository resultRepository,
            ProtocolMutationGuard mutationGuard,
            ProtocolAccessService accessService,
            ProtocolAuditService auditService,
            ProtocolContentVersionService contentVersionService) {
        this.protocolRepository = protocolRepository;
        this.pointRepository = pointRepository;
        this.resultRepository = resultRepository;
        this.mutationGuard = mutationGuard;
        this.accessService = accessService;
        this.auditService = auditService;
        this.contentVersionService = contentVersionService;
    }

    // ── Read ─────────────────────────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<ProtocolApiDtos.SamplingPointResponse> list(Long protocolId, Long userId) {
        Protocol protocol = getProtocolOrThrow(protocolId);
        accessService.assertCanView(userId, protocol);
        return pointRepository.findByProtocolIdOrderBySortOrderAscIdAsc(protocolId).stream()
                .map(ProtocolApiDtos.SamplingPointResponse::from)
                .toList();
    }

    // ── Create ───────────────────────────────────────────────────────────────────────────────────

    @Transactional
    public ProtocolApiDtos.SamplingPointResponse create(Long protocolId,
                                                        ProtocolApiDtos.SamplingPointRequest request,
                                                        Long protocolVersion, Long userId) {
        Protocol protocol = getProtocolOrThrow(protocolId);
        accessService.assertCanEdit(userId, protocol);
        mutationGuard.requireEditable(protocol, ProtocolMutationAction.ADD_SAMPLING_POINT);
        ContentVersioning.requireCurrentVersion(protocol.getVersion(), protocolVersion);

        validateRequest(request);

        ProtocolSamplingPoint point = new ProtocolSamplingPoint();
        point.setProtocolId(protocolId);
        applyFields(point, request);
        point = pointRepository.saveAndFlush(point);
        invalidateGeneratedDocuments(protocol);

        auditService.log(protocolId, ProtocolAuditAction.SAMPLING_POINT_ADDED,
                protocol.getStatus(), protocol.getStatus(), userId,
                "Добавлена точка отбора: " + point.getName());

        return ProtocolApiDtos.SamplingPointResponse.from(point);
    }

    // ── Update ───────────────────────────────────────────────────────────────────────────────────

    @Transactional
    public ProtocolApiDtos.SamplingPointResponse update(Long protocolId, Long pointId,
                                                        Long ifMatch,
                                                        ProtocolApiDtos.SamplingPointRequest request,
                                                        Long userId) {
        Protocol protocol = getProtocolOrThrow(protocolId);
        accessService.assertCanEdit(userId, protocol);
        mutationGuard.requireEditable(protocol, ProtocolMutationAction.UPDATE_SAMPLING_POINT);

        ProtocolSamplingPoint point = getPointOrThrow(pointId, protocolId);
        Long version = ifMatch != null ? ifMatch : request.version();
        ContentVersioning.requireCurrentVersion(point.getVersion(), version);

        validateRequest(request);
        applyFields(point, request);
        point = pointRepository.saveAndFlush(point);
        invalidateGeneratedDocuments(protocol);

        auditService.log(protocolId, ProtocolAuditAction.SAMPLING_POINT_UPDATED,
                protocol.getStatus(), protocol.getStatus(), userId,
                "Обновлена точка отбора: " + point.getName());

        return ProtocolApiDtos.SamplingPointResponse.from(point);
    }

    // ── Delete ───────────────────────────────────────────────────────────────────────────────────

    @Transactional
    public void delete(Long protocolId, Long pointId, Long version, Long userId) {
        Protocol protocol = getProtocolOrThrow(protocolId);
        accessService.assertCanEdit(userId, protocol);
        mutationGuard.requireEditable(protocol, ProtocolMutationAction.DELETE_SAMPLING_POINT);

        ProtocolSamplingPoint point = getPointOrThrow(pointId, protocolId);
        ContentVersioning.requireCurrentVersion(point.getVersion(), version);

        long resultCount = pointRepository.countResultsByPointId(pointId);
        if (resultCount > 0) {
            throw new ConflictException(
                    "Точка отбора содержит " + resultCount + " результатов. Удалите или переназначьте их перед удалением точки.",
                    "SAMPLING_POINT_HAS_RESULTS");
        }

        String name = point.getName();
        pointRepository.delete(point);
        invalidateGeneratedDocuments(protocol);

        auditService.log(protocolId, ProtocolAuditAction.SAMPLING_POINT_DELETED,
                protocol.getStatus(), protocol.getStatus(), userId,
                "Удалена точка отбора: " + name);
    }

    // ── Bulk copy indicators ─────────────────────────────────────────────────────────────────────

    /**
     * Copies indicator metadata from all results of sourcePointId into each targetPointId as new
     * result rows. The actual measured values (resultValue, resultMgM3, resultMgDm3, etc.) are
     * intentionally NOT copied — the operator fills those in for each point separately. Only
     * fields that define what is being measured (indicatorName, unit, normativeId, normativeValue,
     * testingMethodNd, samplingMethodNd, indicatorName, pollutantCode, formula, casNumber) are
     * copied so the target points start with the same indicator list as the source.
     */
    @Transactional
    public int copyIndicators(Long protocolId, Long protocolVersion,
                              ProtocolApiDtos.CopyIndicatorsRequest request, Long userId) {
        Protocol protocol = getProtocolOrThrow(protocolId);
        accessService.assertCanEdit(userId, protocol);
        mutationGuard.requireEditable(protocol, ProtocolMutationAction.COPY_INDICATORS);
        ContentVersioning.requireCurrentVersion(protocol.getVersion(), protocolVersion);

        if (request.sourcePointId() == null) {
            throw new BadRequestException("sourcePointId обязателен", "SOURCE_POINT_REQUIRED");
        }
        if (request.targetPointIds() == null || request.targetPointIds().isEmpty()) {
            throw new BadRequestException("targetPointIds не может быть пустым", "TARGET_POINTS_REQUIRED");
        }

        getPointOrThrow(request.sourcePointId(), protocolId);
        for (Long targetId : request.targetPointIds()) {
            if (targetId.equals(request.sourcePointId())) {
                throw new BadRequestException("sourcePointId не может быть в targetPointIds", "SELF_COPY");
            }
            getPointOrThrow(targetId, protocolId);
        }

        List<ProtocolResult> sourceResults = resultRepository.findByProtocolIdOrderByRowNumberAsc(protocolId)
                .stream()
                .filter(r -> request.sourcePointId().equals(r.getSamplingPointId()))
                .toList();

        if (sourceResults.isEmpty()) {
            return 0;
        }

        // Determine next rowNumber base — use max existing rowNumber + 1 to avoid collisions.
        Integer maxRow = resultRepository.findTopByProtocolIdOrderByRowNumberDesc(protocolId)
                .map(ProtocolResult::getRowNumber).orElse(0);

        List<ProtocolResult> newRows = new ArrayList<>();
        int rowNum = maxRow + 1;

        for (Long targetPointId : request.targetPointIds()) {
            Set<String> existingIndicators = resultRepository.findByProtocolIdOrderByRowNumberAsc(protocolId)
                    .stream()
                    .filter(r -> targetPointId.equals(r.getSamplingPointId()))
                    .map(ProtocolResult::getIndicatorName)
                    .collect(Collectors.toCollection(HashSet::new));
            for (ProtocolResult src : sourceResults) {
                if (existingIndicators.contains(src.getIndicatorName())) {
                    continue;
                }
                ProtocolResult copy = copyIndicatorMetadata(src, protocolId, targetPointId, rowNum++);
                newRows.add(copy);
                existingIndicators.add(src.getIndicatorName());
            }
        }

        resultRepository.saveAll(newRows);
        invalidateGeneratedDocuments(protocol);

        auditService.log(protocolId, ProtocolAuditAction.INDICATORS_COPIED,
                protocol.getStatus(), protocol.getStatus(), userId,
                "Скопированы показатели из точки " + request.sourcePointId()
                        + " в точки " + request.targetPointIds() + " (" + newRows.size() + " строк)");

        return newRows.size();
    }

    private void invalidateGeneratedDocuments(Protocol protocol) {
        protocol.setDocxFileId(null);
        protocol.setPdfFileId(null);
        protocol.setPdfIsFallback(false);
        protocol.setPdfSourceContentVersion(null);
        contentVersionService.bump(protocol);
    }

    // ── Public helpers ───────────────────────────────────────────────────────────────────────────

    /** Load all points for a protocol, keyed by id — used by document generation service. */
    @Transactional(readOnly = true)
    public Map<Long, ProtocolSamplingPoint> loadPointsById(Long protocolId) {
        return pointRepository.findByProtocolIdOrderBySortOrderAscIdAsc(protocolId)
                .stream().collect(Collectors.toMap(ProtocolSamplingPoint::getId, p -> p));
    }

    @Transactional(readOnly = true)
    public List<ProtocolSamplingPoint> loadPoints(Long protocolId) {
        return pointRepository.findByProtocolIdOrderBySortOrderAscIdAsc(protocolId);
    }

    // ── Private helpers ──────────────────────────────────────────────────────────────────────────

    private Protocol getProtocolOrThrow(Long protocolId) {
        return protocolRepository.findById(protocolId)
                .orElseThrow(() -> new NotFoundException("Протокол не найден: " + protocolId));
    }

    private ProtocolSamplingPoint getPointOrThrow(Long pointId, Long protocolId) {
        return pointRepository.findByIdAndProtocolId(pointId, protocolId)
                .orElseThrow(() -> new NotFoundException(
                        "Точка отбора не найдена: " + pointId + " (протокол " + protocolId + ")"));
    }

    private void validateRequest(ProtocolApiDtos.SamplingPointRequest request) {
        if (request.name() == null || request.name().isBlank()) {
            throw new BadRequestException("Укажите название точки отбора (name)", "SAMPLING_POINT_NAME_REQUIRED");
        }
        if (request.latitude() != null && (request.latitude().compareTo(new java.math.BigDecimal("-90")) < 0
                || request.latitude().compareTo(new java.math.BigDecimal("90")) > 0)) {
            throw new BadRequestException("latitude должна быть в диапазоне от -90 до 90", "INVALID_LATITUDE");
        }
        if (request.longitude() != null && (request.longitude().compareTo(new java.math.BigDecimal("-180")) < 0
                || request.longitude().compareTo(new java.math.BigDecimal("180")) > 0)) {
            throw new BadRequestException("longitude должна быть в диапазоне от -180 до 180", "INVALID_LONGITUDE");
        }
    }

    private void applyFields(ProtocolSamplingPoint point, ProtocolApiDtos.SamplingPointRequest request) {
        point.setName(request.name().trim());
        point.setDescription(request.description());
        point.setLatitude(request.latitude());
        point.setLongitude(request.longitude());
        point.setSortOrder(request.sortOrder() != null ? request.sortOrder() : 0);
    }

    private ProtocolResult copyIndicatorMetadata(ProtocolResult src, Long protocolId,
                                                  Long targetPointId, int rowNumber) {
        ProtocolResult copy = new ProtocolResult();
        copy.setProtocolId(protocolId);
        copy.setSamplingPointId(targetPointId);
        copy.setRowNumber(rowNumber);

        // Indicator metadata — what is being measured.
        copy.setIndicatorName(src.getIndicatorName());
        copy.setUnit(src.getUnit());
        copy.setNormativeId(src.getNormativeId());
        copy.setNormativeType(src.getNormativeType());
        copy.setNormativeValue(src.getNormativeValue());
        copy.setMinValue(src.getMinValue());
        copy.setMaxValue(src.getMaxValue());
        copy.setTestingMethodNd(src.getTestingMethodNd());
        copy.setSamplingMethodNd(src.getSamplingMethodNd());
        copy.setPollutantCode(src.getPollutantCode());
        copy.setFormula(src.getFormula());
        copy.setCasNumber(src.getCasNumber());
        copy.setNormativeDocument(src.getNormativeDocument());
        copy.setComparisonType(src.getComparisonType());
        copy.setSampleName(src.getSampleName());
        copy.setSubtype(src.getSubtype());
        copy.setDurationMinutes(src.getDurationMinutes());

        // Deliberately NOT copied: resultValue, resultMgM3, resultMgDm3, coPercent, pdkMgM3,
        // pdkOrBackground, avgValue, pdvMgM3, pdvGs, pdsMgDm3, complianceStatus, internalStatus,
        // calculationStatus, calculatedAt, note, valuesJson (raw measured data per point).

        return copy;
    }
}
