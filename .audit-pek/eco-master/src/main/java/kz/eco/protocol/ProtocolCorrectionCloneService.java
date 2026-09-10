package kz.eco.protocol;

import kz.eco.protocol.calculation.RawMeasurement;
import kz.eco.protocol.calculation.RawMeasurementRepository;
import org.springframework.stereotype.Service;

import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * P1 module fix item 6: single, complete implementation of the createCorrection clone (SIGNED ->
 * REPLACED old / DRAFT new), replacing the previous hand-maintained field list in
 * {@code ProtocolService#cloneProtocol} which silently dropped objectId/laboratoryId/executorId
 * and most of {@link ProtocolEnvironmentConditions}'s type-specific columns (season/workCategory/
 * roomType/... - anything added after the original list was written just never made it into a
 * correction). Both {@link Protocol} and {@link ProtocolEnvironmentConditions} clone every
 * persistent field EXCEPT the explicitly excluded ones below, via reflection - the only way to
 * guarantee a newly-added column is copied by default instead of silently dropped until someone
 * remembers to update a hand-written list here too. Raw measurements are cloned per-result with
 * old-resultId -&gt; new-resultId remapping, since {@link RawMeasurement#getProtocolResultId()}
 * would otherwise point at a row that no longer belongs to the new protocol.
 */
@Service
public class ProtocolCorrectionCloneService {

    /** Everything workflow/signing/publish/approval/generated-file/audit-identity related - the
     *  new protocol is a fresh DRAFT, never a continuation of the old row's lifecycle state. */
    private static final Set<String> EXCLUDED_PROTOCOL_FIELDS = Set.of(
            "id", "version", "status", "createdAt", "updatedAt", "createdBy",
            "protocolNumber", "deletedAt",
            "approvedBy", "approvedAt", "approvedPdfHash", "approvedContentVersion",
            "signedBy", "signedAt", "signatureFileId", "signatureCertificateMetadata", "pdfSha256",
            "docxFileId", "pdfFileId", "pdfIsFallback", "pdfSourceContentVersion",
            "publishedAt", "publishedBy",
            "replacedProtocolId", "replacedByProtocolId", "replacementReason",
            "contentVersion"
    );

    private static final Set<String> EXCLUDED_ENVIRONMENT_FIELDS = Set.of("id", "protocolId");

    private final ProtocolResultRepository resultRepository;
    private final ProtocolEnvironmentConditionsRepository envConditionsRepository;
    private final RawMeasurementRepository rawMeasurementRepository;
    private final ProtocolNumberGenerator numberGenerator;

    public ProtocolCorrectionCloneService(ProtocolResultRepository resultRepository,
                                           ProtocolEnvironmentConditionsRepository envConditionsRepository,
                                           RawMeasurementRepository rawMeasurementRepository,
                                           ProtocolNumberGenerator numberGenerator) {
        this.resultRepository = resultRepository;
        this.envConditionsRepository = envConditionsRepository;
        this.rawMeasurementRepository = rawMeasurementRepository;
        this.numberGenerator = numberGenerator;
    }

    /** Clones the Protocol header row itself - caller is responsible for saving it (and for
     *  calling {@link #cloneResultsAndMeasurements}/{@link #cloneEnvironment} afterward, once the
     *  new row has a real id to attach children to). */
    public Protocol cloneHeader(Protocol source, ProtocolTemplate template, Long userId, Long replacedId, String reason) {
        Protocol copy = new Protocol();
        copyFields(source, copy, Protocol.class, EXCLUDED_PROTOCOL_FIELDS);
        copy.setStatus(ProtocolStatus.DRAFT);
        copy.setCreatedBy(userId);
        copy.setProtocolNumber(numberGenerator.generate(template, source.getProtocolDate()));
        copy.setReplacedProtocolId(replacedId);
        copy.setReplacementReason(reason);
        return copy;
    }

    /** Clones every ProtocolResult row (via the existing, already-comprehensive
     *  {@link ProtocolResultMapper#copy}) and, for each, every {@link RawMeasurement} row -
     *  remapped from the old result's id to the newly-saved copy's id, since raw measurements are
     *  keyed by protocolResultId, not protocolId. */
    public void cloneResultsAndMeasurements(Long sourceProtocolId, Long newProtocolId) {
        List<ProtocolResult> sourceResults = resultRepository.findByProtocolIdOrderByRowNumberAsc(sourceProtocolId);
        int rowNumber = 1;
        for (ProtocolResult sourceResult : sourceResults) {
            ProtocolResult copy = ProtocolResultMapper.copy(sourceResult, newProtocolId, rowNumber++);
            copy = resultRepository.save(copy);
            List<RawMeasurement> sourceMeasurements = rawMeasurementRepository.findByProtocolResultId(sourceResult.getId());
            for (RawMeasurement sourceMeasurement : sourceMeasurements) {
                RawMeasurement measurementCopy = new RawMeasurement();
                measurementCopy.setProtocolResultId(copy.getId());
                measurementCopy.setVariableKey(sourceMeasurement.getVariableKey());
                measurementCopy.setVariableValue(sourceMeasurement.getVariableValue());
                measurementCopy.setUnit(sourceMeasurement.getUnit());
                measurementCopy.setSourceType(sourceMeasurement.getSourceType());
                measurementCopy.setDeviceId(sourceMeasurement.getDeviceId());
                rawMeasurementRepository.save(measurementCopy);
            }
        }
    }

    /** Clones the (at most one) {@link ProtocolEnvironmentConditions} row, every field except
     *  id/protocolId. */
    public void cloneEnvironment(Long sourceProtocolId, Long newProtocolId) {
        envConditionsRepository.findByProtocolId(sourceProtocolId).ifPresent(source -> {
            ProtocolEnvironmentConditions copy = new ProtocolEnvironmentConditions();
            copyFields(source, copy, ProtocolEnvironmentConditions.class, EXCLUDED_ENVIRONMENT_FIELDS);
            copy.setProtocolId(newProtocolId);
            envConditionsRepository.save(copy);
        });
    }

    private static <T> void copyFields(T source, T target, Class<T> type, Set<String> excluded) {
        Map<String, Field> fields = new LinkedHashMap<>();
        for (Field field : type.getDeclaredFields()) {
            if (Modifier.isStatic(field.getModifiers()) || excluded.contains(field.getName())) {
                continue;
            }
            fields.put(field.getName(), field);
        }
        for (Field field : fields.values()) {
            field.setAccessible(true);
            try {
                field.set(target, field.get(source));
            } catch (IllegalAccessException e) {
                throw new IllegalStateException("Не удалось скопировать поле " + field.getName() + " при создании исправленной версии", e);
            }
        }
    }
}
