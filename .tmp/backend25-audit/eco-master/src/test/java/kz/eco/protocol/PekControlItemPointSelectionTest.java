package kz.eco.protocol;

import com.jayway.jsonpath.JsonPath;
import kz.eco.common.exception.BadRequestException;
import kz.eco.common.exception.ConflictException;
import kz.eco.pek.PekFrequencyType;
import kz.eco.pek.PekMonitoringPoint;
import kz.eco.pek.PekMonitoringPointRepository;
import kz.eco.pek.PekMonitoringType;
import kz.eco.pek.PekProgramControlItem;
import kz.eco.pek.PekProgramControlItemRepository;
import kz.eco.pek.PekProgramIndicator;
import kz.eco.pek.PekProgramIndicatorRepository;
import kz.eco.pek.PekProgramMonitoring;
import kz.eco.pek.PekProgramMonitoringRepository;
import kz.eco.pek.PekProgramRepository;
import kz.eco.pek.PekProgramSectionsService;
import kz.eco.pek.PekProgramService;
import kz.eco.pek.PekProgramStatus;
import kz.eco.pek.dto.PekApiDtos;
import kz.eco.user.User;
import kz.eco.user.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Point selection of ПЭК control items: a position is bound either to one concrete monitoring point
 * or explicitly to all points, and a position with neither must not be fanned out across every
 * point. Reproduces the reported case - "Воздух — северная точка" / "Воздух — южная точка" against
 * ТК-01 / ТК-02 - which used to produce four requirements instead of two.
 */
@SpringBootTest
@Transactional
class PekControlItemPointSelectionTest {

    @Autowired private WebApplicationContext context;
    @Autowired private PekProgramTestFixture fixtures;
    @Autowired private PekProgramControlItemRepository controlItemRepository;
    @Autowired private PekProgramMonitoringRepository monitoringRepository;
    @Autowired private PekMonitoringPointRepository pointRepository;
    @Autowired private PekProgramIndicatorRepository indicatorRepository;
    @Autowired private PekProgramRepository programRepository;
    @Autowired private PekProgramService programService;
    @Autowired private PekProgramSectionsService sectionsService;

    private MockMvc mvc;
    private User head;
    private LocalDate date;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        head = fixtures.user("pek-points-head-", UserRole.HEAD);
        date = LocalDate.now();
    }

    /** The reported programme: one air направление, points ТК-01 Северная / ТК-02 Южная, and one
     *  position per point, each bound to its point by id. */
    private record NorthSouth(PekProgramTestFixture.Fixture f, Long northItemId, Long southItemId,
                              Long northPointId, Long southPointId) { }

    private NorthSouth northSouth(PekProgramStatus status) {
        PekProgramTestFixture.Fixture f = fixtures.standard(date.getYear(), head, PekFrequencyType.QUARTERLY, 1,
                status, true);

        PekMonitoringPoint north = pointRepository.findById(f.pointId()).orElseThrow();
        north.setName("ТК-01 Северная");
        pointRepository.saveAndFlush(north);

        PekMonitoringPoint south = new PekMonitoringPoint();
        south.setProgramId(f.programId());
        south.setMonitoringId(f.monitoringId());
        south.setName("ТК-02 Южная");
        pointRepository.saveAndFlush(south);

        PekProgramControlItem northItem = controlItemRepository.findById(f.controlItemId()).orElseThrow();
        northItem.setName("Воздух — северная точка");
        northItem.setMonitoringPointId(north.getId());
        controlItemRepository.saveAndFlush(northItem);

        PekProgramControlItem southItem = new PekProgramControlItem();
        southItem.setProgramId(f.programId());
        southItem.setCode("AIR-2");
        southItem.setName("Воздух — южная точка");
        southItem.setControlType(northItem.getControlType());
        southItem.setEnvironmentComponent(northItem.getEnvironmentComponent());
        southItem.setFrequencyType(northItem.getFrequencyType());
        southItem.setFrequencyValue(northItem.getFrequencyValue());
        southItem.setLaboratoryId(northItem.getLaboratoryId());
        southItem.setActive(true);
        southItem.setMonitoringPointId(south.getId());
        controlItemRepository.saveAndFlush(southItem);

        PekProgramIndicator indicator = new PekProgramIndicator();
        indicator.setProgramId(f.programId());
        indicator.setControlItemId(southItem.getId());
        indicator.setIndicatorName("Азота диоксид");
        indicator.setUnit("мг/м³");
        indicator.setNormativeValue(new BigDecimal("0.2"));
        indicator.setComparisonType(ComparisonType.LESS_OR_EQUAL);
        indicatorRepository.saveAndFlush(indicator);

        PekProgramMonitoring monitoring = monitoringRepository.findById(f.monitoringId()).orElseThrow();
        Set<Long> items = new LinkedHashSet<>(monitoring.getControlItemIds());
        items.add(southItem.getId());
        monitoring.setControlItemIds(items);
        monitoringRepository.saveAndFlush(monitoring);

        return new NorthSouth(f, northItem.getId(), southItem.getId(), north.getId(), south.getId());
    }

    private RequestPostProcessor as(User u) {
        Authentication auth = new UsernamePasswordAuthenticationToken(
                u, null, List.of(new SimpleGrantedAuthority("ROLE_" + u.getRole().name())));
        return authentication(auth);
    }

    private List<Map<String, Object>> requirements(PekProgramTestFixture.Fixture f) throws Exception {
        String body = mvc.perform(get("/api/protocols/creation-context").with(as(head))
                        .param("companyId", String.valueOf(f.companyId()))
                        .param("objectId", String.valueOf(f.objectId()))
                        .param("date", date.toString()))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.data.requirements");
    }

    private static Long longOf(Object value) {
        return value == null ? null : Long.valueOf(value.toString());
    }

    private String fromPekBody(PekProgramTestFixture.Fixture f, Long itemId, Long pointId) {
        return """
                {"companyId":%d,"objectId":%d,"pekProgramId":%d,"pekMonitoringId":%d,
                 "pekControlItemId":%d,"monitoringPointId":%s,"protocolTemplateId":"ambient_air",
                 "date":"%s"}
                """.formatted(f.companyId(), f.objectId(), f.programId(), f.monitoringId(),
                itemId, pointId == null ? "null" : pointId.toString(), date);
    }

    private void updateItem(Long itemId, Long pointId, boolean allPoints) {
        PekProgramControlItem item = controlItemRepository.findById(itemId).orElseThrow();
        item.setMonitoringPointId(pointId);
        item.setAppliesToAllPoints(allPoints);
        controlItemRepository.saveAndFlush(item);
    }

    private PekApiDtos.ControlItemDto itemDto(Long id, String code, String name, Long pointId, Boolean allPoints) {
        return new PekApiDtos.ControlItemDto(id, code, name, null, "EMISSION", null,
                pointId, allPoints, null, null, null, null,
                "QUARTERLY", 1, null, null, null, null, null, null, null, null, null);
    }

    private void editItems(Long programId, List<PekApiDtos.ControlItemDto> items) {
        Long version = programRepository.findById(programId).orElseThrow().getVersion();
        programService.edit(programId, new PekApiDtos.EditProgramRequest(null, null, null, null, null,
                null, null, items, null, null), version, head.getId());
    }

    // ------------------------------------------------------------------ creation context -------

    @Test
    void northAndSouth_produceExactlyTwoRequirements_eachWithItsOwnPoint() throws Exception {
        NorthSouth ns = northSouth(PekProgramStatus.ACTIVE);

        List<Map<String, Object>> reqs = requirements(ns.f());

        assertEquals(2, reqs.size(), "one requirement per position, not positions x points");
        Map<Long, Map<String, Object>> byItem = reqs.stream()
                .collect(Collectors.toMap(r -> longOf(r.get("pekControlItemId")), r -> r));

        Map<String, Object> north = byItem.get(ns.northItemId());
        assertEquals(ns.northPointId(), longOf(north.get("monitoringPointId")));
        assertEquals("ТК-01 Северная", north.get("monitoringPointName"));
        assertEquals("DUE", north.get("status"));
        assertEquals(Boolean.TRUE, north.get("canCreate"));

        Map<String, Object> south = byItem.get(ns.southItemId());
        assertEquals(ns.southPointId(), longOf(south.get("monitoringPointId")));
        assertEquals("ТК-02 Южная", south.get("monitoringPointName"));
        assertEquals("DUE", south.get("status"));
        assertEquals(Boolean.TRUE, south.get("canCreate"));
    }

    @Test
    void concretePoint_isNotMultipliedAcrossTheOtherPointsOfTheDirection() throws Exception {
        NorthSouth ns = northSouth(PekProgramStatus.ACTIVE);
        // Leave only the northern position in the направление; the direction still has both points.
        PekProgramMonitoring monitoring = monitoringRepository.findById(ns.f().monitoringId()).orElseThrow();
        monitoring.setControlItemIds(Set.of(ns.northItemId()));
        monitoringRepository.saveAndFlush(monitoring);

        List<Map<String, Object>> reqs = requirements(ns.f());

        assertEquals(1, reqs.size());
        assertEquals(ns.northPointId(), longOf(reqs.get(0).get("monitoringPointId")));
    }

    @Test
    void appliesToAllPoints_createsOneRequirementPerPointOfTheDirection() throws Exception {
        NorthSouth ns = northSouth(PekProgramStatus.ACTIVE);
        PekProgramMonitoring monitoring = monitoringRepository.findById(ns.f().monitoringId()).orElseThrow();
        monitoring.setControlItemIds(Set.of(ns.northItemId()));
        monitoringRepository.saveAndFlush(monitoring);
        updateItem(ns.northItemId(), null, true);

        List<Map<String, Object>> reqs = requirements(ns.f());

        assertEquals(2, reqs.size());
        assertEquals(Set.of(ns.northPointId(), ns.southPointId()),
                reqs.stream().map(r -> longOf(r.get("monitoringPointId"))).collect(Collectors.toSet()));
        assertTrue(reqs.stream().allMatch(r -> Boolean.TRUE.equals(r.get("canCreate"))));
    }

    @Test
    void emptySetting_isOneConfigurationRequiredRequirement_notFannedOut() throws Exception {
        NorthSouth ns = northSouth(PekProgramStatus.ACTIVE);
        PekProgramMonitoring monitoring = monitoringRepository.findById(ns.f().monitoringId()).orElseThrow();
        monitoring.setControlItemIds(Set.of(ns.northItemId()));
        monitoringRepository.saveAndFlush(monitoring);
        updateItem(ns.northItemId(), null, false);

        List<Map<String, Object>> reqs = requirements(ns.f());

        assertEquals(1, reqs.size(), "an unconfigured position must not be multiplied across the two points");
        assertEquals("CONFIGURATION_REQUIRED", reqs.get(0).get("status"));
        assertEquals(Boolean.FALSE, reqs.get(0).get("canCreate"));
        assertNull(reqs.get(0).get("monitoringPointId"));
        assertNull(reqs.get(0).get("monitoringPointName"));
    }

    @Test
    void fromPek_forUnconfiguredPosition_isRejected_evenWhenCalledDirectly() throws Exception {
        NorthSouth ns = northSouth(PekProgramStatus.ACTIVE);
        updateItem(ns.northItemId(), null, false);

        mvc.perform(post("/api/protocols/from-pek").with(as(head)).contentType(MediaType.APPLICATION_JSON)
                        .content(fromPekBody(ns.f(), ns.northItemId(), ns.northPointId())))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONFIGURATION_REQUIRED"));
    }

    @Test
    void fromPek_withTheOtherPositionsPoint_isRejected() throws Exception {
        NorthSouth ns = northSouth(PekProgramStatus.ACTIVE);

        mvc.perform(post("/api/protocols/from-pek").with(as(head)).contentType(MediaType.APPLICATION_JSON)
                        .content(fromPekBody(ns.f(), ns.northItemId(), ns.southPointId())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PEK_CONTEXT_MISMATCH"));
    }

    @Test
    void repeatedGeneration_doesNotDuplicateRequirementsOrDrafts() throws Exception {
        NorthSouth ns = northSouth(PekProgramStatus.ACTIVE);

        Set<Object> firstKeys = requirements(ns.f()).stream().map(r -> r.get("id")).collect(Collectors.toSet());
        Set<Object> secondKeys = requirements(ns.f()).stream().map(r -> r.get("id")).collect(Collectors.toSet());
        assertEquals(2, firstKeys.size());
        assertEquals(firstKeys, secondKeys);

        mvc.perform(post("/api/protocols/from-pek").with(as(head)).contentType(MediaType.APPLICATION_JSON)
                        .content(fromPekBody(ns.f(), ns.northItemId(), ns.northPointId())))
                .andExpect(status().is2xxSuccessful());
        mvc.perform(post("/api/protocols/from-pek").with(as(head)).contentType(MediaType.APPLICATION_JSON)
                        .content(fromPekBody(ns.f(), ns.northItemId(), ns.northPointId())))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PROTOCOL_DRAFT_ALREADY_EXISTS"));

        Map<Long, Map<String, Object>> byItem = requirements(ns.f()).stream()
                .collect(Collectors.toMap(r -> longOf(r.get("pekControlItemId")), r -> r));
        assertEquals(2, byItem.size());
        assertNotNull(byItem.get(ns.northItemId()).get("existingDraftProtocolId"));
        assertEquals(Boolean.FALSE, byItem.get(ns.northItemId()).get("canCreate"));
        assertNull(byItem.get(ns.southItemId()).get("existingDraftProtocolId"),
                "a draft for the northern point must not be attributed to the southern one");
        assertEquals(Boolean.TRUE, byItem.get(ns.southItemId()).get("canCreate"));
    }

    // ------------------------------------------------------------------ saving a programme -----

    @Test
    void save_pointTogetherWithAllPoints_is400() {
        NorthSouth ns = northSouth(PekProgramStatus.DRAFT);

        BadRequestException ex = assertThrows(BadRequestException.class, () -> editItems(ns.f().programId(),
                List.of(itemDto(ns.northItemId(), "AIR-1", "Воздух — северная точка", ns.northPointId(), true))));
        assertEquals("PEK_CONTROL_ITEM_POINT_AMBIGUOUS", ex.getCode());
    }

    @Test
    void save_nonexistentPoint_is400() {
        NorthSouth ns = northSouth(PekProgramStatus.DRAFT);

        BadRequestException ex = assertThrows(BadRequestException.class, () -> editItems(ns.f().programId(),
                List.of(itemDto(ns.northItemId(), "AIR-1", "Воздух — северная точка", 987_654_321L, false))));
        assertEquals("PEK_MONITORING_POINT_INVALID", ex.getCode());
    }

    @Test
    void save_pointOfAnotherProgramme_is400() {
        NorthSouth ns = northSouth(PekProgramStatus.DRAFT);
        PekProgramTestFixture.Fixture foreign = fixtures.standard(date.getYear(), head, PekFrequencyType.QUARTERLY, 1,
                PekProgramStatus.DRAFT, true);

        BadRequestException ex = assertThrows(BadRequestException.class, () -> editItems(ns.f().programId(),
                List.of(itemDto(ns.northItemId(), "AIR-1", "Воздух — северная точка", foreign.pointId(), false))));
        assertEquals("PEK_MONITORING_POINT_INVALID", ex.getCode());
    }

    @Test
    void save_pointOfAnotherDirection_is400() {
        NorthSouth ns = northSouth(PekProgramStatus.DRAFT);
        PekProgramMonitoring water = new PekProgramMonitoring();
        water.setProgramId(ns.f().programId());
        water.setMonitoringType(PekMonitoringType.WASTEWATER);
        water.setName("Сточные воды");
        water.setActive(true);
        monitoringRepository.saveAndFlush(water);
        PekMonitoringPoint outlet = new PekMonitoringPoint();
        outlet.setProgramId(ns.f().programId());
        outlet.setMonitoringId(water.getId());
        outlet.setName("Выпуск №1");
        pointRepository.saveAndFlush(outlet);

        BadRequestException ex = assertThrows(BadRequestException.class, () -> editItems(ns.f().programId(),
                List.of(itemDto(ns.northItemId(), "AIR-1", "Воздух — северная точка", outlet.getId(), false),
                        itemDto(ns.southItemId(), "AIR-2", "Воздух — южная точка", ns.southPointId(), false))));
        assertEquals("PEK_MONITORING_POINT_INVALID", ex.getCode());
    }

    @Test
    void save_validSettings_arePersistedAndReturned() {
        NorthSouth ns = northSouth(PekProgramStatus.DRAFT);

        editItems(ns.f().programId(), List.of(
                itemDto(ns.northItemId(), "AIR-1", "Воздух — северная точка", ns.northPointId(), false),
                itemDto(ns.southItemId(), "AIR-2", "Воздух — южная точка", null, true)));

        PekProgramControlItem north = controlItemRepository.findById(ns.northItemId()).orElseThrow();
        assertEquals(ns.northPointId(), north.getMonitoringPointId());
        assertFalse(north.isAppliesToAllPoints());
        PekProgramControlItem south = controlItemRepository.findById(ns.southItemId()).orElseThrow();
        assertNull(south.getMonitoringPointId());
        assertTrue(south.isAppliesToAllPoints());
    }

    @Test
    void deletingAPointStillBoundToAPosition_is409() {
        NorthSouth ns = northSouth(PekProgramStatus.DRAFT);
        Long version = pointRepository.findById(ns.northPointId()).orElseThrow().getVersion();

        ConflictException ex = assertThrows(ConflictException.class,
                () -> sectionsService.deletePoint(ns.f().programId(), ns.northPointId(), version));
        assertEquals("PEK_MONITORING_POINT_IN_USE", ex.getCode());
    }

    // ------------------------------------------------------------------ clone ------------------

    @Test
    void clone_keepsPointSettings_boundToTheClonesOwnPoints() {
        NorthSouth ns = northSouth(PekProgramStatus.ACTIVE);
        updateItem(ns.southItemId(), null, true);

        PekApiDtos.ProgramResponse clone = programService.clone(ns.f().programId(),
                new PekApiDtos.CloneProgramRequest("CLONE-" + System.nanoTime(), null, null, null), head.getId());

        Map<String, PekProgramControlItem> items = controlItemRepository
                .findByProgramIdOrderBySortOrderAsc(clone.id()).stream()
                .collect(Collectors.toMap(PekProgramControlItem::getName, i -> i));
        Map<Long, PekMonitoringPoint> clonePoints = pointRepository.findByProgramIdOrderByIdAsc(clone.id()).stream()
                .collect(Collectors.toMap(PekMonitoringPoint::getId, p -> p));
        assertEquals(2, clonePoints.size());

        PekProgramControlItem north = items.get("Воздух — северная точка");
        assertNotNull(north.getMonitoringPointId());
        assertNotEquals(ns.northPointId(), north.getMonitoringPointId(),
                "the clone must not point at the source programme's point");
        assertEquals("ТК-01 Северная", clonePoints.get(north.getMonitoringPointId()).getName());
        assertFalse(north.isAppliesToAllPoints());

        PekProgramControlItem south = items.get("Воздух — южная точка");
        assertNull(south.getMonitoringPointId());
        assertTrue(south.isAppliesToAllPoints());

        List<PekProgramMonitoring> cloneMonitorings = monitoringRepository.findByProgramId(clone.id());
        assertEquals(1, cloneMonitorings.size());
        assertEquals(new HashSet<>(List.of(north.getId(), south.getId())),
                new HashSet<>(cloneMonitorings.get(0).getControlItemIds()));
    }
}
