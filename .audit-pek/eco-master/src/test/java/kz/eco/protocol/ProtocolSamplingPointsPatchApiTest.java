package kz.eco.protocol;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** PATCH /api/protocols/{id}[/draft] transactional sampling-points sync (module fix): create,
 *  update-by-id, delete-missing, lat/long range validation, delete blocked while a result still
 *  references the point, version bump, and the returned samplingPoints carry server ids. */
@SpringBootTest
@Transactional
class ProtocolSamplingPointsPatchApiTest extends ProtocolApiTestSupport {

    @Autowired WebApplicationContext context;
    @Autowired ProtocolSamplingPointRepository samplingPointRepository;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        seedProtocolFixtures();
        authenticateLabUser();
        mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    private String createDraft() throws Exception {
        MvcResult created = mockMvc.perform(post("/api/protocols/drafts")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"templateId\":\"" + templateApiId + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return JsonPath.read(created.getResponse().getContentAsString(), "$.data.id").toString();
    }

    private long version(String protocolId) throws Exception {
        MvcResult result = mockMvc.perform(get("/api/protocols/" + protocolId))
                .andExpect(status().isOk()).andReturn();
        return version(result);
    }

    private long version(MvcResult result) throws Exception {
        Object v = JsonPath.read(result.getResponse().getContentAsString(), "$.data.version");
        return Long.parseLong(String.valueOf(v));
    }

    @Test
    void createUpdateDelete_samplingPointsRoundTripThroughPatch() throws Exception {
        String id = createDraft();
        long v0 = version(id);

        String addTwo = """
                {
                  "version": %d,
                  "samplingPoints": [
                    {"name": "Точка 1", "latitude": 43.238949, "longitude": 76.889709, "sortOrder": 0},
                    {"name": "Точка 2", "latitude": 43.25, "longitude": 76.9, "sortOrder": 1}
                  ]
                }
                """.formatted(v0);
        MvcResult afterAdd = mockMvc.perform(patch("/api/protocols/" + id + "/draft")
                        .contentType(MediaType.APPLICATION_JSON).content(addTwo))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.samplingPoints.length()").value(2))
                .andExpect(jsonPath("$.data.samplingPoints[0].id").exists())
                .andExpect(jsonPath("$.data.samplingPoints[0].name").value("Точка 1"))
                .andExpect(jsonPath("$.data.samplingPoints[1].name").value("Точка 2"))
                .andReturn();
        long v1 = version(afterAdd);
        assertTrue(v1 > v0, "sampling-points sync must bump the protocol version");

        List<Integer> ids = JsonPath.read(afterAdd.getResponse().getContentAsString(), "$.data.samplingPoints[*].id");
        assertEquals(2, samplingPointRepository.findByProtocolIdOrderBySortOrderAscIdAsc(Long.parseLong(id)).size());
        long point1Id = ids.get(0);
        long point2Id = ids.get(1);

        // Update point1 by id, omit point2 entirely -> point2 must be deleted, point1 updated.
        String updateAndDelete = """
                {
                  "version": %d,
                  "samplingPoints": [
                    {"id": %d, "name": "Точка 1 (обновлена)", "latitude": 43.24, "longitude": 76.9, "sortOrder": 0}
                  ]
                }
                """.formatted(v1, point1Id);
        MvcResult afterSync = mockMvc.perform(patch("/api/protocols/" + id + "/draft")
                        .contentType(MediaType.APPLICATION_JSON).content(updateAndDelete))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.samplingPoints.length()").value(1))
                .andExpect(jsonPath("$.data.samplingPoints[0].id").value((int) point1Id))
                .andExpect(jsonPath("$.data.samplingPoints[0].name").value("Точка 1 (обновлена)"))
                .andReturn();
        long v2 = version(afterSync);
        assertTrue(v2 > v1);

        List<ProtocolSamplingPoint> remaining = samplingPointRepository.findByProtocolIdOrderBySortOrderAscIdAsc(Long.parseLong(id));
        assertEquals(1, remaining.size());
        assertEquals(point1Id, remaining.get(0).getId());
        assertTrue(samplingPointRepository.findByIdAndProtocolId(point2Id, Long.parseLong(id)).isEmpty());
    }

    @Test
    void invalidLatitude_isRejected() throws Exception {
        String id = createDraft();
        long v0 = version(id);
        String body = """
                {"version": %d, "samplingPoints": [{"name": "Точка X", "latitude": 95, "longitude": 10}]}
                """.formatted(v0);
        mockMvc.perform(patch("/api/protocols/" + id + "/draft")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_LATITUDE"));
    }

    @Test
    void invalidLongitude_isRejected() throws Exception {
        String id = createDraft();
        long v0 = version(id);
        String body = """
                {"version": %d, "samplingPoints": [{"name": "Точка X", "latitude": 10, "longitude": -181}]}
                """.formatted(v0);
        mockMvc.perform(patch("/api/protocols/" + id + "/draft")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_LONGITUDE"));
    }

    @Test
    void samplingPointWithMismatchedId_isRejectedAsNotBelongingToProtocol() throws Exception {
        String id = createDraft();
        long v0 = version(id);
        String body = """
                {"version": %d, "samplingPoints": [{"id": 999999999, "name": "Точка X"}]}
                """.formatted(v0);
        mockMvc.perform(patch("/api/protocols/" + id + "/draft")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("SAMPLING_POINT_NOT_FOUND"));
    }

    @Test
    void staleSamplingPointVersion_returns409ProtocolVersionConflict() throws Exception {
        String id = createDraft();
        long v0 = version(id);
        String addOne = """
                {"version": %d, "samplingPoints": [{"name": "Точка 1", "latitude": 43.2, "longitude": 76.9}]}
                """.formatted(v0);
        MvcResult afterAdd = mockMvc.perform(patch("/api/protocols/" + id + "/draft")
                        .contentType(MediaType.APPLICATION_JSON).content(addOne))
                .andExpect(status().isOk()).andReturn();
        long v1 = version(afterAdd);
        long pointId = ((Number) ((List<?>) JsonPath.read(afterAdd.getResponse().getContentAsString(),
                "$.data.samplingPoints[*].id")).get(0)).longValue();

        String staleUpdate = """
                {"version": %d, "samplingPoints": [{"id": %d, "name": "x", "version": 999}]}
                """.formatted(v1, pointId);
        mockMvc.perform(patch("/api/protocols/" + id + "/draft")
                        .contentType(MediaType.APPLICATION_JSON).content(staleUpdate))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PROTOCOL_VERSION_CONFLICT"));
    }

    @Test
    void deletingPointStillReferencedByResult_isBlockedWith409() throws Exception {
        String id = createDraft();
        long v0 = version(id);
        String addOne = """
                {"version": %d, "samplingPoints": [{"name": "Точка 1", "latitude": 43.2, "longitude": 76.9}]}
                """.formatted(v0);
        MvcResult afterAdd = mockMvc.perform(patch("/api/protocols/" + id + "/draft")
                        .contentType(MediaType.APPLICATION_JSON).content(addOne))
                .andExpect(status().isOk()).andReturn();
        long v1 = version(afterAdd);
        long pointId = ((Number) ((List<?>) JsonPath.read(afterAdd.getResponse().getContentAsString(),
                "$.data.samplingPoints[*].id")).get(0)).longValue();

        // Attach a result to this sampling point directly via the repository (result creation
        // itself is covered by other test suites; here we only need one row referencing the point).
        ProtocolResult result = new ProtocolResult();
        result.setProtocolId(Long.parseLong(id));
        result.setSamplingPointId(pointId);
        result.setRowNumber(1);
        result.setIndicatorName("Пыль");
        resultRepository.saveAndFlush(result);

        String removePoint = """
                {"version": %d, "samplingPoints": []}
                """.formatted(v1);
        mockMvc.perform(patch("/api/protocols/" + id + "/draft")
                        .contentType(MediaType.APPLICATION_JSON).content(removePoint))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("SAMPLING_POINT_HAS_RESULTS"));

        assertTrue(samplingPointRepository.findByIdAndProtocolId(pointId, Long.parseLong(id)).isPresent());
    }

    @Test
    void resultReferencingSamplingPoint_roundTripsSamplingPointIdInResponse() throws Exception {
        String id = createDraft();
        long v0 = version(id);
        String addOne = """
                {"version": %d, "samplingPoints": [{"name": "Точка 1", "latitude": 43.2, "longitude": 76.9}]}
                """.formatted(v0);
        MvcResult afterAdd = mockMvc.perform(patch("/api/protocols/" + id + "/draft")
                        .contentType(MediaType.APPLICATION_JSON).content(addOne))
                .andExpect(status().isOk()).andReturn();
        long pointId = ((Number) ((List<?>) JsonPath.read(afterAdd.getResponse().getContentAsString(),
                "$.data.samplingPoints[*].id")).get(0)).longValue();

        ProtocolResult result = new ProtocolResult();
        result.setProtocolId(Long.parseLong(id));
        result.setSamplingPointId(pointId);
        result.setRowNumber(1);
        result.setIndicatorName("Пыль");
        resultRepository.saveAndFlush(result);

        mockMvc.perform(get("/api/protocols/" + id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.results[0].samplingPointId").value((int) pointId));
    }
}
