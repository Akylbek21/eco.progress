package kz.eco.normative;

import kz.eco.protocol.dto.ProtocolApiDtos;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

@Service
public class NormativeSearchService {

    private final NormativeDirectoryService directoryService;

    public NormativeSearchService(NormativeDirectoryService directoryService) {
        this.directoryService = directoryService;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> search(String query, String q, String code, String pollutantCode,
                                      String indicator, String templateId, String subtype,
                                      String unit, Long objectId, String date,
                                      String environmentType, String normativeType,
                                      String normativeSubType) {
        return search(query, q, code, pollutantCode, indicator, templateId, subtype, unit, objectId, date,
                environmentType, normativeType, normativeSubType,
                null, null, null, null, null, null, null, null, null, null,
                null, null, null, null);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> search(String query, String q, String code, String pollutantCode,
                                      String indicator, String templateId, String subtype,
                                      String unit, Long objectId, String date,
                                      String environmentType, String normativeType,
                                      String normativeSubType,
                                      String sourceDocumentCode,
                                      String factorType, String factorCode,
                                      String roomType, String season,
                                      String workCategory, String workplaceType,
                                      String normLevel, Integer appendixNo, Integer tableNo) {
        return search(query, q, code, pollutantCode, indicator, templateId, subtype, unit, objectId, date,
                environmentType, normativeType, normativeSubType,
                sourceDocumentCode, factorType, factorCode, roomType, season,
                workCategory, workplaceType, normLevel, appendixNo, tableNo,
                null, null, null, null);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> search(String query, String q, String code, String pollutantCode,
                                      String indicator, String templateId, String subtype,
                                      String unit, Long objectId, String date,
                                      String environmentType, String normativeType,
                                      String normativeSubType,
                                      String sourceDocumentCode,
                                      String factorType, String factorCode,
                                      String roomType, String season,
                                      String workCategory, String workplaceType,
                                      String normLevel, Integer appendixNo, Integer tableNo,
                                      String status, Boolean active, Integer page, Integer size) {
        return search(query, q, code, pollutantCode, indicator, templateId, subtype, unit, objectId, date,
                environmentType, normativeType, normativeSubType,
                sourceDocumentCode, factorType, factorCode, roomType, season,
                workCategory, workplaceType, normLevel, appendixNo, tableNo,
                status, active, page, size,
                null, null, null, null, null, null);
    }

    /** Full-shape search: everything the 27-arg overload takes, plus categoryCode/waterType
     * (DSM-138 water scoping) and waterUseCategory/visualWorkCategory/lightingType/noiseType
     * (see NormativeQuery.withExtraConditions for why these 4 aren't threaded through the
     * fromExtendedParams vararg chain itself). Defaults allowCrossContextFallback to false - see
     * the 34-arg overload below for the flag itself. */
    @Transactional(readOnly = true)
    public Map<String, Object> search(String query, String q, String code, String pollutantCode,
                                      String indicator, String templateId, String subtype,
                                      String unit, Long objectId, String date,
                                      String environmentType, String normativeType,
                                      String normativeSubType,
                                      String sourceDocumentCode,
                                      String factorType, String factorCode,
                                      String roomType, String season,
                                      String workCategory, String workplaceType,
                                      String normLevel, Integer appendixNo, Integer tableNo,
                                      String status, Boolean active, Integer page, Integer size,
                                      String categoryCode, String waterType,
                                      String waterUseCategory, String visualWorkCategory,
                                      String lightingType, String noiseType) {
        return search(query, q, code, pollutantCode, indicator, templateId, subtype, unit, objectId, date,
                environmentType, normativeType, normativeSubType,
                sourceDocumentCode, factorType, factorCode, roomType, season,
                workCategory, workplaceType, normLevel, appendixNo, tableNo,
                status, active, page, size, categoryCode, waterType,
                waterUseCategory, visualWorkCategory, lightingType, noiseType, false);
    }

    /**
     * Same as the 33-arg overload, plus allowCrossContextFallback: when the strict search (scoped
     * to the caller's templateId) finds nothing, the old behavior silently re-ran the same query
     * with templateId dropped and surfaced whatever it found in a DIFFERENT protocol type - which
     * meant protocol creation could quietly attach a normative from the wrong section. That
     * broadening is now off by default; only pass true from an explicitly admin-gated caller (see
     * NormativeReferenceController.search) that genuinely wants "search everywhere" browsing.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> search(String query, String q, String code, String pollutantCode,
                                      String indicator, String templateId, String subtype,
                                      String unit, Long objectId, String date,
                                      String environmentType, String normativeType,
                                      String normativeSubType,
                                      String sourceDocumentCode,
                                      String factorType, String factorCode,
                                      String roomType, String season,
                                      String workCategory, String workplaceType,
                                      String normLevel, Integer appendixNo, Integer tableNo,
                                      String status, Boolean active, Integer page, Integer size,
                                      String categoryCode, String waterType,
                                      String waterUseCategory, String visualWorkCategory,
                                      String lightingType, String noiseType,
                                      boolean allowCrossContextFallback) {
        NormativeDirectoryService.NormativeQuery normativeQuery = buildQuery(
                query, q, code, pollutantCode, indicator, templateId, subtype, unit, objectId, date,
                environmentType, normativeType, normativeSubType,
                sourceDocumentCode, factorType, factorCode, roomType, season,
                workCategory, workplaceType, normLevel, appendixNo, tableNo,
                status, active, page, size, categoryCode, waterType)
                .withExtraConditions(waterUseCategory, visualWorkCategory, lightingType, noiseType);
        String warning = null;
        Map<String, Object> payload = directoryService.searchWithPagination(normativeQuery, null);
        if (allowCrossContextFallback && Boolean.FALSE.equals(payload.get("found"))
                && templateId != null && !templateId.isBlank()) {
            NormativeDirectoryService.NormativeQuery fallback = buildQuery(
                    query, q, code, pollutantCode, indicator, null, subtype, unit, objectId, date,
                    environmentType, normativeType, normativeSubType,
                    sourceDocumentCode, factorType, factorCode, roomType, season,
                    workCategory, workplaceType, normLevel, appendixNo, tableNo,
                    status, active, page, size, categoryCode, waterType)
                    .withExtraConditions(waterUseCategory, visualWorkCategory, lightingType, noiseType);
            warning = "Норматив найден в другом разделе. Проверьте тип протокола.";
            Map<String, Object> fallbackPayload = directoryService.searchWithPagination(fallback, warning);
            if (Boolean.TRUE.equals(fallbackPayload.get("found"))) {
                payload = fallbackPayload;
            }
        }
        return payload;
    }

    @Transactional(readOnly = true)
    public List<ProtocolApiDtos.NormativeRecord> list(String query, String q, String code, String pollutantCode,
                                                      String indicator, String templateId, String subtype,
                                                      String unit, Long objectId, String date,
                                                      String environmentType, String normativeType,
                                                      String normativeSubType,
                                                      String sourceDocumentCode,
                                                      String factorType, String factorCode,
                                                      String roomType, String season,
                                                      String workCategory, String workplaceType,
                                                      String normLevel, Integer appendixNo, Integer tableNo,
                                                      String status, Boolean active, Integer page, Integer size) {
        return directoryService.list(buildQuery(
                query, q, code, pollutantCode, indicator, templateId, subtype, unit, objectId, date,
                environmentType, normativeType, normativeSubType,
                sourceDocumentCode, factorType, factorCode, roomType, season,
                workCategory, workplaceType, normLevel, appendixNo, tableNo,
                status, active, page, size, null, null));
    }

    @Transactional(readOnly = true)
    public ProtocolApiDtos.NormativeSearchResponse searchForProtocol(String query, String q, String code, String pollutantCode,
                                                                    String indicator, String templateId, String subtype,
                                                                    String unit, Long objectId, String date) {
        NormativeDirectoryService.NormativeQuery normativeQuery = buildQuery(
                query, q, code, pollutantCode, indicator, templateId, subtype, unit, objectId, date,
                null, null, subtype,
                null, null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, null);
        return directoryService.searchForProtocol(normativeQuery);
    }

    private static NormativeDirectoryService.NormativeQuery buildQuery(String query, String q, String code,
                                                                       String pollutantCode, String indicator,
                                                                       String templateId, String subtype,
                                                                       String unit, Long objectId, String date,
                                                                       String environmentType, String normativeType,
                                                                       String normativeSubType,
                                                                       String sourceDocumentCode,
                                                                       String factorType, String factorCode,
                                                                       String roomType, String season,
                                                                       String workCategory, String workplaceType,
                                                                       String normLevel, Integer appendixNo,
                                                                       Integer tableNo,
                                                                       String status, Boolean active,
                                                                       Integer page, Integer size,
                                                                       String categoryCode, String waterType) {
        String effectiveStatus = status;
        if ((effectiveStatus == null || effectiveStatus.isBlank()) && active != null) {
            effectiveStatus = active ? "ACTIVE" : "ARCHIVED";
        }
        // IMPORTANT: fromExtendedParams' fixed-parameter list ends at ...size, categoryCode,
        // waterType before the String... searchCandidates varargs start. This call used to stop
        // at `size` (27 fixed args short by 2), which doesn't fail to compile - Java's overload
        // resolution silently reinterprets the trailing arguments to fit an available signature,
        // so `query` and `q` landed in the categoryCode/waterType parameter slots instead of
        // ever reaching the free-text search matcher. That's why searching by name/formula/CAS
        // returned nothing while an exact `code=` search (which doesn't rely on this vararg tail)
        // kept working - see NormativeSearchApiTest for the regression tests that catch this.
        return NormativeDirectoryService.NormativeQuery.fromExtendedParams(
                null,
                templateId,
                pollutantCode != null ? pollutantCode : code,
                indicator,
                subtype,
                unit,
                objectId,
                date,
                environmentType,
                normativeType,
                normativeSubType,
                active != null ? active : true,
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
                effectiveStatus,
                page,
                size,
                categoryCode,
                waterType,
                query, q, code, pollutantCode, indicator
        );
    }
}
