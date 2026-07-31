package kz.eco.normative;

import kz.eco.common.ApiResponse;
import kz.eco.user.SecurityExpressions;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/pollutants")
@PreAuthorize(SecurityExpressions.LAB_PROTOCOL)
public class PollutantSearchController {

    private final PollutantSearchService searchService;

    public PollutantSearchController(PollutantSearchService searchService) {
        this.searchService = searchService;
    }

    @GetMapping("/search")
    public ApiResponse<Map<String, List<Map<String, Object>>>> search(
            @RequestParam(required = false) String query,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String pollutantCode,
            @RequestParam(required = false) String indicator,
            @RequestParam(required = false) String templateId,
            @RequestParam(required = false) String subtype,
            @RequestParam(required = false) String unit,
            @RequestParam(required = false) Long objectId,
            @RequestParam(required = false) String date) {
        List<Map<String, Object>> pollutants = searchService.search(
                query, q, code, pollutantCode, indicator, templateId, subtype, unit, objectId, date);
        Map<String, List<Map<String, Object>>> payload = new LinkedHashMap<>();
        payload.put("pollutants", pollutants);
        payload.put("items", pollutants);
        payload.put("results", pollutants);
        return ApiResponse.ok(payload);
    }
}
