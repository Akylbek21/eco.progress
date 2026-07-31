package kz.eco.normative;

import kz.eco.common.SearchTextUtils;
import kz.eco.protocol.NormativeReference;
import kz.eco.protocol.NormativeReferenceRepository;
import kz.eco.protocol.ProtocolApiMapper;
import kz.eco.protocol.ProtocolTemplateCode;
import kz.eco.protocol.dto.ProtocolApiDtos;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
public class NormativeDirectoryService {

    private static final int SEARCH_LIMIT = 100;

    private final NormativeRecordRepository normativeRecordRepository;
    private final NormativeReferenceRepository normativeReferenceRepository;
    private final NormativeRecordMapper normativeRecordMapper;
    private final ProtocolApiMapper protocolApiMapper;

    public NormativeDirectoryService(NormativeRecordRepository normativeRecordRepository,
                                     NormativeReferenceRepository normativeReferenceRepository,
                                     NormativeRecordMapper normativeRecordMapper,
                                     ProtocolApiMapper protocolApiMapper) {
        this.normativeRecordRepository = normativeRecordRepository;
        this.normativeReferenceRepository = normativeReferenceRepository;
        this.normativeRecordMapper = normativeRecordMapper;
        this.protocolApiMapper = protocolApiMapper;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> listRecords(NormativeQuery query) {
        NormativeQuery effective = query != null ? query : NormativeQuery.empty();
        // Uncapped on purpose: this endpoint does real page/size pagination below, so applying
        // SEARCH_LIMIT here would silently hide everything past the 100th match instead of
        // just putting it on a later page - exactly the "results disappeared" complaint this
        // was meant to avoid. The cap still applies to search() (used for un-paginated
        // autocomplete-style lookups elsewhere), where there is no pagination to fall back on.
        List<ProtocolApiDtos.NormativeRecord> filtered = buildFilteredList(effective, Integer.MAX_VALUE);
        List<ProtocolApiDtos.NormativeRecord> content = paginate(filtered, effective.page(), effective.size());

        int size = effective.size() != null && effective.size() > 0 ? effective.size() : filtered.size();
        // Zero-based: page=0 is the first page (matches the frontend contract), not one-based.
        int pageIndex = effective.page() != null && effective.page() >= 0 ? effective.page() : 0;
        int totalElements = filtered.size();
        int totalPages = size > 0 ? (int) Math.ceil((double) totalElements / size) : 0;

        Map<String, Object> payload = buildSearchPayload(content, null);
        payload.put("content", content);
        payload.put("totalElements", totalElements);
        payload.put("totalPages", totalPages);
        payload.put("number", pageIndex);
        payload.put("page", pageIndex);
        payload.put("size", size);
        payload.put("limited", false);
        return payload;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> buildSearchPayload(List<ProtocolApiDtos.NormativeRecord> records, String message) {
        List<ProtocolApiDtos.NormativeRecord> merged = records != null ? records : List.of();
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("records", merged);
        payload.put("normatives", merged);
        payload.put("items", merged);
        payload.put("results", merged);
        payload.put("found", !merged.isEmpty());
        payload.put("ambiguous", merged.size() > 1);
        if (message != null && !message.isBlank()) {
            payload.put("message", message);
        }
        return payload;
    }

    /**
     * Un-paginated lookup for callers with no pagination UI (e.g. protocol quick-create's
     * indicator autocomplete). Capped at SEARCH_LIMIT when a search term is present, purely to
     * bound how much gets built into a single dropdown - {@link #listRecords} is the paginated,
     * uncapped path meant for the actual normatives directory screen.
     */
    @Transactional(readOnly = true)
    public List<ProtocolApiDtos.NormativeRecord> search(NormativeQuery query) {
        NormativeQuery effective = query != null ? query : NormativeQuery.empty();
        List<ProtocolApiDtos.NormativeRecord> merged = buildFilteredList(effective, SEARCH_LIMIT);
        return paginate(merged, effective.page(), effective.size());
    }

    /** Real page/size/totalElements/totalPages (uncapped total, like listRecords) merged with
     * the records/normatives/items/results search-response shape GET /api/normatives/search
     * contracts to. */
    @Transactional(readOnly = true)
    public Map<String, Object> searchWithPagination(NormativeQuery query, String message) {
        NormativeQuery effective = query != null ? query : NormativeQuery.empty();
        List<ProtocolApiDtos.NormativeRecord> filtered = buildFilteredList(effective, Integer.MAX_VALUE);
        List<ProtocolApiDtos.NormativeRecord> content = paginate(filtered, effective.page(), effective.size());

        int size = effective.size() != null && effective.size() > 0 ? effective.size() : filtered.size();
        int pageIndex = effective.page() != null && effective.page() >= 0 ? effective.page() : 0;
        int totalElements = filtered.size();
        int totalPages = size > 0 ? (int) Math.ceil((double) totalElements / size) : 0;

        Map<String, Object> payload = buildSearchPayload(content, message);
        payload.put("page", pageIndex);
        payload.put("size", size);
        payload.put("totalElements", totalElements);
        payload.put("totalPages", totalPages);
        return payload;
    }

    /** True if a plain {@link #search} call on this query would have its search results capped. */
    @Transactional(readOnly = true)
    public boolean isSearchLimited(NormativeQuery query) {
        NormativeQuery effective = query != null ? query : NormativeQuery.empty();
        if (!effective.hasSearchText()) {
            return false;
        }
        return buildFilteredList(effective, Integer.MAX_VALUE).size() > SEARCH_LIMIT;
    }

    private List<ProtocolApiDtos.NormativeRecord> buildFilteredList(NormativeQuery effective, int limit) {
        List<ProtocolApiDtos.NormativeRecord> merged = new ArrayList<>();
        merged.addAll(loadImportedRecords(effective));
        merged.addAll(loadLegacyRecords(effective));
        merged = deduplicate(merged);
        merged = new ArrayList<>(applyFilters(merged, effective));
        merged = merged.stream()
                .filter(record -> NormativeApiContract.matchesStatus(record, effective.status()))
                .filter(NormativeDirectoryService::hasUsefulContent)
                .collect(java.util.stream.Collectors.toCollection(ArrayList::new));
        merged.sort(relevanceComparator(effective));
        if (effective.hasSearchText() && merged.size() > limit) {
            merged = List.copyOf(merged.subList(0, limit));
        }
        return merged;
    }

    @Transactional(readOnly = true)
    public List<ProtocolApiDtos.NormativeRecord> list(NormativeQuery query) {
        return search(query);
    }

    /** relevanceScore DESC, then the spec's stable tie-break: indicatorName, pollutantCode, id
     *  (all ASC) - see relevanceScore for the point system. */
    private static Comparator<ProtocolApiDtos.NormativeRecord> relevanceComparator(NormativeQuery query) {
        return Comparator
                .comparingInt((ProtocolApiDtos.NormativeRecord r) -> relevanceScore(r, query)).reversed()
                .thenComparing(r -> SearchTextUtils.firstNonBlank(r.indicatorName(), r.indicator()),
                        Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER))
                .thenComparing(ProtocolApiDtos.NormativeRecord::pollutantCode,
                        Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER))
                .thenComparing(r -> parseIdSafe(r.id()), Comparator.nullsLast(Comparator.naturalOrder()));
    }

    /**
     * Server-side relevance score so the best match for the caller's search always sorts first,
     * instead of a plain alphabetical-by-indicator list: exact pollutantCode/code match (+1000
     * each), exact CAS (+950), exact indicator name (+900), exact formula (+850), name starts with
     * the search text (+700), every search token found in the name (+600), at least one token
     * found (+300), plus small bonuses for matching the caller's structural context
     * (templateId/sourceDocumentCode +200 each, factorType +150, categoryCode +100, unit +50).
     */
    private static int relevanceScore(ProtocolApiDtos.NormativeRecord record, NormativeQuery query) {
        int score = 0;
        String exactCode = query.pollutantCode();
        if (exactCode != null && !exactCode.isBlank()) {
            if (exactCode.equalsIgnoreCase(record.pollutantCode())) score += 1000;
            if (exactCode.equalsIgnoreCase(record.code())) score += 1000;
        }
        String search = query.searchText();
        if (search != null && !search.isBlank()) {
            String needle = SearchTextUtils.normalizeText(search);
            String name = SearchTextUtils.normalizeText(
                    SearchTextUtils.firstNonBlank(record.indicatorName(), record.indicator(), record.indicatorNameRu()));
            String cas = SearchTextUtils.normalizeText(record.casNumber());
            String formula = SearchTextUtils.normalizeText(
                    SearchTextUtils.firstNonBlank(record.formula(), record.chemicalFormula()));
            if (!cas.isBlank() && cas.equals(needle)) {
                score += 950;
            }
            if (!name.isBlank() && name.equals(needle)) {
                score += 900;
            }
            if (!formula.isBlank() && formula.equals(needle)) {
                score += 850;
            }
            if (!name.isBlank() && name.startsWith(needle)) {
                score += 700;
            }
            List<String> tokens = SearchTextUtils.searchTokens(search);
            if (!name.isBlank() && !tokens.isEmpty()) {
                boolean allTokensMatch = true;
                boolean anyTokenMatches = false;
                for (String token : tokens) {
                    boolean tokenMatches = name.contains(SearchTextUtils.normalizeText(token));
                    allTokensMatch &= tokenMatches;
                    anyTokenMatches |= tokenMatches;
                }
                if (allTokensMatch) {
                    score += 600;
                } else if (anyTokenMatches) {
                    score += 300;
                }
            }
        }
        if (matchesIgnoreCase(query.templateId(), record.templateId())) score += 200;
        if (matchesIgnoreCase(query.sourceDocumentCode(), record.sourceDocumentCode())) score += 200;
        if (matchesIgnoreCase(query.factorType(), record.factorType())) score += 150;
        if (matchesIgnoreCase(query.categoryCode(), record.categoryCode())) score += 100;
        if (matchesIgnoreCase(query.unit(), record.unit())) score += 50;
        return score;
    }

    private static boolean matchesIgnoreCase(String queryValue, String recordValue) {
        return queryValue != null && !queryValue.isBlank() && queryValue.equalsIgnoreCase(recordValue);
    }

    private static Long parseIdSafe(String id) {
        if (id == null || id.isBlank()) {
            return null;
        }
        try {
            return Long.parseLong(id.trim());
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private static List<ProtocolApiDtos.NormativeRecord> paginate(List<ProtocolApiDtos.NormativeRecord> records,
                                                                  Integer page,
                                                                  Integer size) {
        if (size == null || size <= 0) {
            return records;
        }
        // Zero-based: page=0 is the first page (matches the frontend contract), not one-based.
        int pageIndex = page != null && page >= 0 ? page : 0;
        int from = pageIndex * size;
        if (from >= records.size()) {
            return List.of();
        }
        int to = Math.min(from + size, records.size());
        return List.copyOf(records.subList(from, to));
    }

    @Transactional(readOnly = true)
    public ProtocolApiDtos.NormativeSearchResponse searchForProtocol(NormativeQuery query) {
        List<ProtocolApiDtos.NormativeRecord> records = search(query);
        if (records.isEmpty()) {
            return new ProtocolApiDtos.NormativeSearchResponse(false, null, List.of(), List.of(), false, null);
        }
        return new ProtocolApiDtos.NormativeSearchResponse(
                true,
                records.size() == 1 ? records.getFirst() : null,
                records,
                records,
                records.size() > 1,
                null
        );
    }

    private List<ProtocolApiDtos.NormativeRecord> loadImportedRecords(NormativeQuery query) {
        TemplateType resolvedType = resolveTemplateType(query.templateType(), query.templateId());
        NormativeSourceResolver.ResolvedSource resolvedSource = NormativeSourceResolver.resolve(
                query.templateId(), query.environmentType());
        SourceDocumentCode sourceFilter = query.sourceDocumentCode() != null && !query.sourceDocumentCode().isBlank()
                ? SourceDocumentCode.fromApi(query.sourceDocumentCode())
                : resolvedSource.sourceDocumentCode();

        List<NormativeRecord> records;
        if (sourceFilter != null) {
            records = normativeRecordRepository.findBySourceDocumentCodeAndActiveTrue(sourceFilter.name());
            if (resolvedType != null) {
                records = records.stream()
                        .filter(r -> r.getTemplateType() == null || r.getTemplateType() == resolvedType)
                        .toList();
            }
        } else if (resolvedType != null) {
            records = normativeRecordRepository.findByTemplateType(resolvedType);
        } else {
            records = normativeRecordRepository.findByActiveTrueOrderByPollutantCodeAsc();
        }

        return records.stream()
                .filter(record -> query.activeOnly() == null || record.isActive() == query.activeOnly())
                .filter(record -> matchesEnvironmentType(record, effectiveEnvironmentType(query, resolvedSource)))
                .filter(record -> matchesSourceDocument(record, query.sourceDocumentCode()))
                .filter(record -> matchesPhysicalConditions(record, query))
                .filter(record -> matchesNormativeType(record, query.normativeType()))
                .filter(record -> matchesSubtype(record, query.normativeSubType()))
                .filter(record -> matchesAppendixTable(record, query.appendixNo(), query.tableNo()))
                .filter(record -> isActiveOnDate(record.getEffectiveFrom(), record.getEffectiveTo(), query.onDate()))
                .map(normativeRecordMapper::toApi)
                .filter(java.util.Objects::nonNull)
                .toList();
    }

    private static String effectiveEnvironmentType(NormativeQuery query, NormativeSourceResolver.ResolvedSource resolved) {
        if (query.environmentType() != null && !query.environmentType().isBlank()) {
            return query.environmentType();
        }
        if (resolved.environmentType() != null) {
            return resolved.environmentType().name();
        }
        return null;
    }

    private static boolean matchesSourceDocument(NormativeRecord record, String sourceDocumentCode) {
        if (sourceDocumentCode == null || sourceDocumentCode.isBlank()) {
            return true;
        }
        return record.getSourceDocumentCode() != null
                && sourceDocumentCode.trim().equalsIgnoreCase(record.getSourceDocumentCode());
    }

    private static boolean matchesPhysicalConditions(NormativeRecord record, NormativeQuery query) {
        if (!matchesOptionalField(record.getFactorType(), query.factorType())) {
            return false;
        }
        if (!matchesOptionalField(record.getFactorCode(), query.factorCode())) {
            return false;
        }
        if (!matchesOptionalField(record.getRoomType(), query.roomType())) {
            return false;
        }
        if (!matchesOptionalField(record.getSeason(), query.season())) {
            return false;
        }
        if (!matchesOptionalField(record.getWorkCategory(), query.workCategory())) {
            return false;
        }
        if (!matchesWorkplaceType(record.getWorkplaceType(), query.workplaceType())) {
            return false;
        }
        return matchesOptionalField(record.getNormLevel(), query.normLevel());
    }

    private static boolean matchesWorkplaceType(String recordValue, String queryValue) {
        return matchesWorkplaceTypeOnApi(recordValue, queryValue);
    }

    private static boolean matchesWorkplaceTypeOnApi(String recordValue, String queryValue) {
        if (queryValue == null || queryValue.isBlank()) {
            return true;
        }
        if (recordValue == null) {
            return false;
        }
        return queryValue.trim().equalsIgnoreCase(recordValue.trim())
                || "ANY".equalsIgnoreCase(recordValue.trim());
    }

    private static boolean matchesOptionalField(String recordValue, String queryValue) {
        if (queryValue == null || queryValue.isBlank()) {
            return true;
        }
        return recordValue != null && queryValue.trim().equalsIgnoreCase(recordValue.trim());
    }

    private static boolean matchesAppendixTable(NormativeRecord record, Integer appendixNo, Integer tableNo) {
        if (appendixNo != null && (record.getAppendixNo() == null || !appendixNo.equals(record.getAppendixNo()))) {
            return false;
        }
        return tableNo == null || (record.getTableNo() != null && tableNo.equals(record.getTableNo()));
    }

    private List<ProtocolApiDtos.NormativeRecord> loadLegacyRecords(NormativeQuery query) {
        return normativeReferenceRepository.findByActiveTrueOrderByIndicatorNameAsc().stream()
                .filter(NormativeReference::isActive)
                .filter(record -> query.activeOnly() == null || record.isActive() == query.activeOnly())
                .filter(record -> matchesTemplateId(record, query.templateId()))
                .filter(record -> isActiveOnDate(record.getActiveFrom(), record.getActiveTo(), query.onDate()))
                .map(protocolApiMapper::toNormative)
                .toList();
    }

    private static List<ProtocolApiDtos.NormativeRecord> applyFilters(List<ProtocolApiDtos.NormativeRecord> records,
                                                                      NormativeQuery query) {
        List<ProtocolApiDtos.NormativeRecord> filtered = new ArrayList<>(records);

        if (query.pollutantCode() != null && !query.pollutantCode().isBlank()) {
            String code = PollutantCodeUtils.normalizePollutantCode(query.pollutantCode().trim());
            filtered = filtered.stream()
                    .filter(record -> PollutantCodeUtils.codesMatch(record.pollutantCode(), code)
                            || PollutantCodeUtils.codesMatch(record.code(), code))
                    .toList();
        }

        if (query.indicator() != null && !query.indicator().isBlank()) {
            String indicator = SearchTextUtils.normalizeText(query.indicator());
            filtered = filtered.stream()
                    .filter(record -> NormativeMatchingUtils.matches(record, indicator))
                    .toList();
        }

        if (query.unit() != null && !query.unit().isBlank()) {
            String unit = query.unit().trim().toLowerCase(Locale.ROOT);
            filtered = filtered.stream()
                    .filter(record -> record.unit() != null && record.unit().trim().toLowerCase(Locale.ROOT).equals(unit))
                    .toList();
        }

        if (query.templateId() != null && !query.templateId().isBlank()) {
            filtered = filtered.stream()
                    .filter(record -> NormativeApiContract.matchesTemplateFilter(record.templateId(), query.templateId()))
                    .toList();
        }

        if (query.environmentType() != null && !query.environmentType().isBlank()) {
            String env = query.environmentType().trim().toUpperCase(Locale.ROOT);
            filtered = filtered.stream()
                    .filter(record -> env.equalsIgnoreCase(record.environmentType())
                            || env.equalsIgnoreCase(record.environment()))
                    .toList();
        }

        if (query.normativeType() != null && !query.normativeType().isBlank()) {
            String type = SearchTextUtils.normalizeText(query.normativeType());
            filtered = filtered.stream()
                    .filter(record -> record.normativeType() != null
                            && SearchTextUtils.normalizeText(record.normativeType()).contains(type))
                    .toList();
        }

        if (query.normativeSubType() != null && !query.normativeSubType().isBlank()) {
            String subtype = query.normativeSubType().trim();
            filtered = filtered.stream()
                    .filter(record -> record.normativeSubType() != null
                            && subtype.equalsIgnoreCase(record.normativeSubType()))
                    .toList();
        }

        if (query.searchText() != null && !query.searchText().isBlank()) {
            filtered = filtered.stream()
                    .filter(record -> NormativeMatchingUtils.matches(record, query.searchText()))
                    .toList();
        }

        if (query.sourceDocumentCode() != null && !query.sourceDocumentCode().isBlank()) {
            String source = query.sourceDocumentCode().trim();
            filtered = filtered.stream()
                    .filter(record -> record.sourceDocumentCode() != null
                            && source.equalsIgnoreCase(record.sourceDocumentCode()))
                    .toList();
        }

        if (query.categoryCode() != null && !query.categoryCode().isBlank()) {
            String category = query.categoryCode().trim();
            filtered = filtered.stream()
                    .filter(record -> record.categoryCode() != null
                            && category.equalsIgnoreCase(record.categoryCode()))
                    .toList();
        }

        if (query.waterType() != null && !query.waterType().isBlank()) {
            String waterType = query.waterType().trim();
            filtered = filtered.stream()
                    .filter(record -> record.waterType() != null
                            && waterType.equalsIgnoreCase(record.waterType()))
                    .toList();
        }

        if (query.waterUseCategory() != null && !query.waterUseCategory().isBlank()) {
            String category = query.waterUseCategory().trim();
            filtered = filtered.stream()
                    .filter(record -> record.waterUseCategory() != null
                            && category.equalsIgnoreCase(record.waterUseCategory()))
                    .toList();
        }

        // lightingType/noiseType have no dedicated DSM-15 column - a DSM-15 row is scoped to a
        // specific lighting/noise condition through its factorCode (or, failing that, a
        // conditionJson snippet), the same way visualWorkCategory below aliases into
        // workCategory. Records that don't carry a factorCode/conditionJson at all are left in
        // rather than excluded, since an unclassified row isn't necessarily the wrong one.
        if (query.lightingType() != null && !query.lightingType().isBlank()) {
            String type = query.lightingType().trim();
            filtered = filtered.stream()
                    .filter(record -> matchesPhysicalFactorCondition(record, "LIGHTING", type))
                    .toList();
        }
        if (query.noiseType() != null && !query.noiseType().isBlank()) {
            String type = query.noiseType().trim();
            filtered = filtered.stream()
                    .filter(record -> matchesPhysicalFactorCondition(record, "NOISE", type))
                    .toList();
        }

        if (query.factorType() != null && !query.factorType().isBlank()) {
            filtered = filtered.stream()
                    .filter(record -> record.factorType() != null
                            && query.factorType().trim().equalsIgnoreCase(record.factorType()))
                    .toList();
        }
        if (query.factorCode() != null && !query.factorCode().isBlank()) {
            filtered = filtered.stream()
                    .filter(record -> record.factorCode() != null
                            && query.factorCode().trim().equalsIgnoreCase(record.factorCode()))
                    .toList();
        }
        if (query.season() != null && !query.season().isBlank()) {
            filtered = filtered.stream()
                    .filter(record -> record.season() != null
                            && query.season().trim().equalsIgnoreCase(record.season()))
                    .toList();
        }
        // visualWorkCategory ("категория зрительной работы", used for lighting normatives) is
        // stored in the same workCategory column as microclimate's workCategory - the two are
        // never both meaningful for the same record, so accepting whichever one the caller sent
        // widens lighting search without needing a second dedicated column.
        String effectiveWorkCategory = SearchTextUtils.firstNonBlank(query.workCategory(), query.visualWorkCategory());
        if (effectiveWorkCategory != null && !effectiveWorkCategory.isBlank()) {
            String workCategory = effectiveWorkCategory.trim();
            filtered = filtered.stream()
                    .filter(record -> record.workCategory() != null
                            && workCategory.equalsIgnoreCase(record.workCategory()))
                    .toList();
        }
        if (query.workplaceType() != null && !query.workplaceType().isBlank()) {
            String workplaceType = query.workplaceType().trim();
            filtered = filtered.stream()
                    .filter(record -> matchesWorkplaceTypeOnApi(record.workplaceType(), workplaceType))
                    .toList();
        }
        if (query.normLevel() != null && !query.normLevel().isBlank()) {
            filtered = filtered.stream()
                    .filter(record -> record.normLevel() != null
                            && query.normLevel().trim().equalsIgnoreCase(record.normLevel()))
                    .toList();
        }

        // "category" has no dedicated column - treated as an alias of categoryCode (DSM-138
        // water category), the closest existing concept, rather than inventing a second taxonomy.
        if (query.category() != null && !query.category().isBlank()) {
            String category = query.category().trim();
            filtered = filtered.stream()
                    .filter(record -> record.categoryCode() != null
                            && category.equalsIgnoreCase(record.categoryCode()))
                    .toList();
        }

        if (query.formType() != null && !query.formType().isBlank()) {
            String formType = query.formType().trim();
            filtered = filtered.stream()
                    .filter(record -> record.formType() != null
                            && formType.equalsIgnoreCase(record.formType()))
                    .toList();
        }

        return new ArrayList<>(filtered);
    }

    /**
     * Excludes records with no useful content at all: no name/code, no value/min/max, and no
     * conditions (factorType/factorCode/roomType/season/workCategory/conditionJson) - i.e. rows
     * that carry nothing a caller could act on. Distinct from the ACTIVE/REVIEW classification in
     * NormativeApiContract, which is about whether a record is fully *classified* (has a
     * templateId/sourceDocumentCode/etc) - a record can be classified as REVIEW and still have
     * real content worth showing, so this filter is deliberately looser.
     */
    private static boolean hasUsefulContent(ProtocolApiDtos.NormativeRecord record) {
        boolean hasName = isNotBlank(record.indicatorName()) || isNotBlank(record.indicator())
                || isNotBlank(record.indicatorNameRu()) || isNotBlank(record.indicatorNameKz());
        boolean hasCode = isNotBlank(record.code()) || isNotBlank(record.pollutantCode());
        boolean hasValue = isNotBlank(record.value()) || isNotBlank(record.normativeValue())
                || isNotBlank(record.min()) || isNotBlank(record.max());
        boolean hasConditions = isNotBlank(record.factorType()) || isNotBlank(record.factorCode())
                || isNotBlank(record.roomType()) || isNotBlank(record.season())
                || isNotBlank(record.workCategory()) || isNotBlank(record.conditionJson());
        return hasName || hasCode || hasValue || hasConditions;
    }

    private static boolean isNotBlank(String value) {
        return value != null && !value.isBlank();
    }

    /**
     * The key must be specific enough that two genuinely different normatives (different
     * document, table, category, water type, hazard class, ...) never collapse into one just
     * because they happen to share the same indicator/unit/value - a narrower key was silently
     * dropping real records once DSM_138 (water) started overlapping DSM_70/32 on those fields.
     */
    private static List<ProtocolApiDtos.NormativeRecord> deduplicate(List<ProtocolApiDtos.NormativeRecord> records) {
        Set<String> seen = new LinkedHashSet<>();
        List<ProtocolApiDtos.NormativeRecord> unique = new ArrayList<>();
        for (ProtocolApiDtos.NormativeRecord record : records) {
            String key = dedupKey(record);
            if (seen.add(key)) {
                unique.add(record);
            }
        }
        return unique;
    }

    private static String dedupKey(ProtocolApiDtos.NormativeRecord record) {
        return String.join("|",
                safe(record.sourceDocumentCode()),
                safe(record.templateId()),
                safe(record.environmentType()),
                safe(record.categoryCode()),
                safe(record.appendixNo()),
                safe(record.tableNo()),
                safe(record.code()),
                safe(record.indicator()),
                safe(record.unit()),
                safe(record.value()),
                safe(record.min()),
                safe(record.max()),
                safe(record.comparisonType()),
                safe(record.normativeSubType()),
                safe(record.hazardClass()),
                safe(record.limitingIndicator()),
                safe(record.waterType()),
                safe(record.factorType()),
                safe(record.conditionJson()));
    }

    private static String safe(Object value) {
        return value != null ? value.toString() : "";
    }

    private static boolean matchesSubtype(NormativeRecord record, String subtype) {
        if (subtype == null || subtype.isBlank()) {
            return true;
        }
        return record.getNormativeSubType() != null
                && subtype.trim().equalsIgnoreCase(record.getNormativeSubType());
    }

    private static boolean matchesEnvironmentType(NormativeRecord record, String environmentType) {
        if (environmentType == null || environmentType.isBlank()) {
            return true;
        }
        return record.getEnvironmentType() != null
                && environmentType.trim().equalsIgnoreCase(record.getEnvironmentType().name());
    }

    private static boolean matchesNormativeType(NormativeRecord record, String normativeType) {
        if (normativeType == null || normativeType.isBlank()) {
            return true;
        }
        return record.getNormativeType() != null
                && normativeType.trim().equalsIgnoreCase(record.getNormativeType().name());
    }

    private static boolean matchesTemplateIdOnRecord(ProtocolApiDtos.NormativeRecord record, String templateId) {
        return NormativeApiContract.matchesTemplateFilter(record.templateId(), templateId);
    }

    /** See the lightingType/noiseType filter block in applyFilters for why this checks
     * factorCode/conditionJson instead of a dedicated column. */
    private static boolean matchesPhysicalFactorCondition(ProtocolApiDtos.NormativeRecord record,
                                                            String expectedFactorType, String conditionValue) {
        if (record.factorType() != null && !expectedFactorType.equalsIgnoreCase(record.factorType())) {
            return false;
        }
        if (record.factorCode() != null && conditionValue.equalsIgnoreCase(record.factorCode())) {
            return true;
        }
        if (record.conditionJson() != null
                && record.conditionJson().toLowerCase(Locale.ROOT).contains(conditionValue.toLowerCase(Locale.ROOT))) {
            return true;
        }
        return record.factorCode() == null && record.conditionJson() == null;
    }

    private static boolean isPhysicalFactorTemplate(String templateId) {
        return NormativeApiContract.TEMPLATE_PHYSICAL_FACTORS.equals(
                NormativeApiContract.normalizeTemplateId(templateId));
    }

    private static boolean isActiveOnDate(LocalDate from, LocalDate to, LocalDate onDate) {
        if (onDate == null) {
            return true;
        }
        if (from != null && from.isAfter(onDate)) {
            return false;
        }
        return to == null || !to.isBefore(onDate);
    }

    private static boolean matchesTemplateId(NormativeReference record, String templateId) {
        if (templateId == null || templateId.isBlank()) {
            return true;
        }
        String normalized = templateId.trim().toLowerCase(Locale.ROOT).replace('-', '_');
        String recordTemplate = record.getTemplateCode() != null
                ? record.getTemplateCode().trim().toLowerCase(Locale.ROOT).replace('-', '_')
                : "";
        if (normalized.equals(recordTemplate)) {
            return true;
        }
        ProtocolTemplateCode code = ProtocolTemplateCode.fromApi(normalized);
        if (code != null && code.name().equalsIgnoreCase(record.getTemplateCode())) {
            return true;
        }
        TemplateType recordType = resolveTemplateType(null, recordTemplate);
        TemplateType requestedType = resolveTemplateType(null, normalized);
        return recordType != null && recordType.equals(requestedType);
    }

    /**
     * Delegates to the single canonical ProtocolTemplateMapper.toTemplateType - see its javadoc
     * for why this used to be a second copy of the same synonym switch (and missing most of the
     * physical-factor synonyms because of it).
     */
    static TemplateType resolveTemplateType(String templateType, String templateId) {
        if (templateType != null && !templateType.isBlank()) {
            try {
                return TemplateType.valueOf(templateType.trim().toUpperCase(Locale.ROOT));
            } catch (IllegalArgumentException ignored) {
            }
        }
        return ProtocolTemplateMapper.toTemplateType(templateId);
    }

    private static String templateTypeToApiId(TemplateType type) {
        if (type == null) {
            return null;
        }
        NormativeRecord stub = new NormativeRecord();
        stub.setTemplateType(type);
        return NormativeApiContract.resolveTemplateId(stub);
    }

    public record NormativeQuery(
            String templateType,
            String templateId,
            String pollutantCode,
            String indicator,
            String subtype,
            String normativeSubType,
            String unit,
            Long objectId,
            LocalDate onDate,
            String searchText,
            String environmentType,
            String normativeType,
            Boolean activeOnly,
            String sourceDocumentCode,
            String factorType,
            String factorCode,
            String roomType,
            String season,
            String workCategory,
            String workplaceType,
            String normLevel,
            Integer appendixNo,
            Integer tableNo,
            String status,
            Integer page,
            Integer size,
            String categoryCode,
            String waterType,
            String waterUseCategory,
            String visualWorkCategory,
            String lightingType,
            String noiseType,
            String category,
            String formType
    ) {
        /**
         * Deliberately NOT added as extra parameters to the fromExtendedParams/fromParams
         * factories below: those already take 20+ positional String/Integer arguments ending in
         * a String... vararg tail, and NormativeSearchService.buildQuery once silently passed 2
         * arguments short of that list - Java didn't reject it, it just reinterpreted `query`/`q`
         * as the last two fixed parameters instead of vararg search candidates, which is exactly
         * why free-text search stopped working (see NormativeSearchApiTest). Bolting more fields
         * onto that same fragile shape would only make the next such mismatch more likely and
         * harder to spot. Building the query via the existing factory and then layering these on
         * with this copy-constructor keeps every other call site's arity untouched.
         */
        public NormativeQuery withExtraConditions(String waterUseCategory, String visualWorkCategory,
                                                   String lightingType, String noiseType) {
            return new NormativeQuery(templateType, templateId, pollutantCode, indicator, subtype, normativeSubType,
                    unit, objectId, onDate, searchText, environmentType, normativeType, activeOnly,
                    sourceDocumentCode, factorType, factorCode, roomType, season, workCategory, workplaceType,
                    normLevel, appendixNo, tableNo, status, page, size, categoryCode, waterType,
                    waterUseCategory, visualWorkCategory, lightingType, noiseType, category, formType);
        }

        /** Same bolt-on approach as {@link #withExtraConditions} for the two GET /records-only
         *  filters that don't have a home in the shared positional factory. */
        public NormativeQuery withCategoryAndFormType(String category, String formType) {
            return new NormativeQuery(templateType, templateId, pollutantCode, indicator, subtype, normativeSubType,
                    unit, objectId, onDate, searchText, environmentType, normativeType, activeOnly,
                    sourceDocumentCode, factorType, factorCode, roomType, season, workCategory, workplaceType,
                    normLevel, appendixNo, tableNo, status, page, size, categoryCode, waterType,
                    waterUseCategory, visualWorkCategory, lightingType, noiseType, category, formType);
        }

        public static NormativeQuery empty() {
            return new NormativeQuery(null, null, null, null, null, null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null, null, null, "ACTIVE", null, null, null, null,
                    null, null, null, null, null, null);
        }

        public static NormativeQuery fromParams(String templateType,
                                                String templateId,
                                                String pollutantCode,
                                                String indicator,
                                                String subtype,
                                                String unit,
                                                Long objectId,
                                                String date,
                                                String environmentType,
                                                String normativeType,
                                                String normativeSubType,
                                                Boolean activeOnly,
                                                String... searchCandidates) {
            return fromExtendedParams(templateType, templateId, pollutantCode, indicator, subtype, unit, objectId, date,
                    environmentType, normativeType, normativeSubType, activeOnly,
                    null, null, null, null, null, null, null, null, null, null,
                    null, null, null, null, null,
                    searchCandidates);
        }

        public static NormativeQuery fromExtendedParams(String templateType,
                                                String templateId,
                                                String pollutantCode,
                                                String indicator,
                                                String subtype,
                                                String unit,
                                                Long objectId,
                                                String date,
                                                String environmentType,
                                                String normativeType,
                                                String normativeSubType,
                                                Boolean activeOnly,
                                                String sourceDocumentCode,
                                                String factorType,
                                                String factorCode,
                                                String roomType,
                                                String season,
                                                String workCategory,
                                                String workplaceType,
                                                String normLevel,
                                                Integer appendixNo,
                                                Integer tableNo,
                                                String... searchCandidates) {
            return fromExtendedParams(templateType, templateId, pollutantCode, indicator, subtype, unit, objectId, date,
                    environmentType, normativeType, normativeSubType, activeOnly,
                    sourceDocumentCode, factorType, factorCode, roomType, season, workCategory, workplaceType,
                    normLevel, appendixNo, tableNo, null, null, null, null, null, searchCandidates);
        }

        public static NormativeQuery fromExtendedParams(String templateType,
                                                String templateId,
                                                String pollutantCode,
                                                String indicator,
                                                String subtype,
                                                String unit,
                                                Long objectId,
                                                String date,
                                                String environmentType,
                                                String normativeType,
                                                String normativeSubType,
                                                Boolean activeOnly,
                                                String sourceDocumentCode,
                                                String factorType,
                                                String factorCode,
                                                String roomType,
                                                String season,
                                                String workCategory,
                                                String workplaceType,
                                                String normLevel,
                                                Integer appendixNo,
                                                Integer tableNo,
                                                String status,
                                                Integer page,
                                                Integer size,
                                                String categoryCode,
                                                String waterType,
                                                String... searchCandidates) {
            LocalDate onDate = null;
            if (date != null && !date.isBlank()) {
                try {
                    onDate = ProtocolApiMapper.parseDate(date.trim());
                } catch (RuntimeException ignored) {
                    onDate = LocalDate.now();
                }
            }
            String effectiveStatus = resolveStatus(status, activeOnly);
            return new NormativeQuery(
                    templateType,
                    templateId,
                    pollutantCode,
                    indicator,
                    subtype,
                    normativeSubType != null ? normativeSubType : subtype,
                    unit,
                    objectId,
                    onDate,
                    SearchTextUtils.firstNonBlank(searchCandidates),
                    environmentType,
                    normativeType,
                    activeOnly,
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
                    null, null, null, null, null, null
            );
        }

        private static String resolveStatus(String status, Boolean activeOnly) {
            if (status != null && !status.isBlank()) {
                return status.trim().toUpperCase(Locale.ROOT);
            }
            if (activeOnly != null && !activeOnly) {
                return "ARCHIVED";
            }
            return "ACTIVE";
        }

        private static String firstNonBlank(String... values) {
            for (String value : values) {
                if (value != null && !value.isBlank()) {
                    return value;
                }
            }
            return null;
        }

        public boolean hasSearchText() {
            return searchText != null && !searchText.isBlank();
        }
    }
}
