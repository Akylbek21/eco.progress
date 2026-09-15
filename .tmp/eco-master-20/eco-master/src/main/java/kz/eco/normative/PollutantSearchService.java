package kz.eco.normative;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class PollutantSearchService {

    private static final Logger log = LoggerFactory.getLogger(PollutantSearchService.class);
    private static final int DEFAULT_LIMIT = 20;

    private final PollutantRepository pollutantRepository;

    public PollutantSearchService(PollutantRepository pollutantRepository) {
        this.pollutantRepository = pollutantRepository;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> search(String query, String q, String code, String pollutantCode,
                                            String indicator, String templateId, String subtype,
                                            String unit, Long objectId, String date) {
        String searchText = kz.eco.common.SearchTextUtils.firstNonBlank(query, q, code, pollutantCode, indicator);
        if (PhysicalFactorCatalog.isPhysicalFactorsTemplate(templateId)) {
            return mapPhysicalFactors(PhysicalFactorCatalog.search(searchText, subtype));
        }
        if (searchText == null || searchText.isBlank()) {
            return pollutantRepository.findByActiveTrueOrderByCodeAsc().stream()
                    .limit(DEFAULT_LIMIT)
                    .map(this::toMap)
                    .toList();
        }

        LinkedHashMap<String, Map<String, Object>> byCode = new LinkedHashMap<>();
        for (String token : kz.eco.common.SearchTextUtils.searchTokens(searchText)) {
            if (token.isBlank()) {
                continue;
            }
            for (String variant : codeVariants(token)) {
                for (Pollutant pollutant : pollutantRepository.searchActive(variant.trim(), false, PageRequest.of(0, DEFAULT_LIMIT))) {
                    byCode.putIfAbsent(pollutant.getCode(), toMap(pollutant));
                }
            }
        }
        return new ArrayList<>(byCode.values()).stream().limit(DEFAULT_LIMIT).toList();
    }

    private static List<String> codeVariants(String token) {
        Set<String> variants = new LinkedHashSet<>();
        if (token == null || token.isBlank()) {
            return List.of();
        }
        String trimmed = token.trim();
        variants.add(trimmed);
        String normalized = PollutantCodeUtils.normalizePollutantCode(trimmed);
        if (normalized != null) {
            variants.add(normalized);
            if (normalized.startsWith("0") && normalized.length() == 4) {
                variants.add(normalized.substring(1));
            }
        }
        if (trimmed.matches("\\d{3}")) {
            variants.add("0" + trimmed);
        }
        return List.copyOf(variants);
    }

    private List<Map<String, Object>> mapPhysicalFactors(List<PhysicalFactorCatalog.FactorEntry> entries) {
        List<Map<String, Object>> result = new ArrayList<>();
        for (PhysicalFactorCatalog.FactorEntry entry : entries) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", entry.code());
            row.put("code", entry.code());
            row.put("pollutantCode", entry.code());
            row.put("substanceCode", entry.code());
            row.put("name", entry.nameRu());
            row.put("nameRu", entry.nameRu());
            row.put("nameKz", entry.nameKz());
            row.put("unit", entry.unit());
            row.put("subtype", entry.subtype().name());
            result.add(row);
        }
        return result;
    }

    private Map<String, Object> toMap(Pollutant pollutant) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", pollutant.getId() != null ? String.valueOf(pollutant.getId()) : pollutant.getCode());
        row.put("code", pollutant.getCode());
        row.put("pollutantCode", pollutant.getCode());
        row.put("substanceCode", pollutant.getCode());
        row.put("name", firstNonBlank(pollutant.getNameRu(), pollutant.getNameKz(), pollutant.getCode()));
        row.put("nameRu", pollutant.getNameRu());
        row.put("nameKz", pollutant.getNameKz());
        row.put("cas", pollutant.getCasNumber());
        row.put("casNumber", pollutant.getCasNumber());
        row.put("formula", pollutant.getChemicalFormula());
        row.put("chemicalFormula", pollutant.getChemicalFormula());
        return row;
    }

    private static String firstNonBlank(String... values) {
        return kz.eco.common.SearchTextUtils.firstNonBlank(values);
    }
}
