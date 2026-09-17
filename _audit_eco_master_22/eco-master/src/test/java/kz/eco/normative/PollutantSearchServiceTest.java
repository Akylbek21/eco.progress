package kz.eco.normative;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Transactional
class PollutantSearchServiceTest {

    @Autowired
    private PollutantSearchService searchService;

    @Test
    void physicalFactors_searchByRussianName() {
        List<Map<String, Object>> result = searchService.search(
                "освещ", null, null, null, null, "physical_factors", "LIGHTING",
                null, null, null);
        assertFalse(result.isEmpty());
        assertTrue(String.valueOf(result.getFirst().get("name")).toLowerCase().contains("освещ"));
    }

    @Test
    void physicalFactors_numericQuery_returnsEmptyNotError() {
        List<Map<String, Object>> result = searchService.search(
                "32", null, null, null, null, "physical_factors", "LIGHTING",
                null, null, null);
        assertNotNull(result);
        assertTrue(result.isEmpty());
    }

    @Test
    void emptyQuery_returnsLimitedList() {
        List<Map<String, Object>> result = searchService.search(
                null, null, null, null, null, "physical_factors", "LIGHTING",
                null, null, null);
        assertFalse(result.isEmpty());
        assertTrue(result.size() <= 20);
    }
}
