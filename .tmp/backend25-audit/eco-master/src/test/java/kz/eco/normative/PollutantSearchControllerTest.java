package kz.eco.normative;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.stream.IntStream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class PollutantSearchControllerTest {
    @Test
    void requestedLimitIsAppliedAndCappedAtOneHundred() {
        PollutantSearchService service = mock(PollutantSearchService.class);
        List<Map<String, Object>> values = IntStream.range(0, 120)
                .mapToObj(i -> Map.<String, Object>of("id", i)).toList();
        when(service.search(any(), any(), any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(values);
        PollutantSearchController controller = new PollutantSearchController(service);
        assertEquals(50, controller.search("азот", null, null, null, null,
                null, null, null, null, null, 50).data().get("items").size());
        assertEquals(100, controller.search("азот", null, null, null, null,
                null, null, null, null, null, 1000).data().get("items").size());
        assertThrows(kz.eco.common.exception.BadRequestException.class,
                () -> controller.search("азот", null, null, null, null,
                        null, null, null, null, null, 0));
    }
}
