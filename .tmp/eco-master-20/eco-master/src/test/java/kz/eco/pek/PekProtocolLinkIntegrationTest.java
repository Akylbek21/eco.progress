package kz.eco.pek;

import kz.eco.common.exception.BadRequestException;
import kz.eco.common.exception.NotFoundException;
import kz.eco.company.Company;
import kz.eco.company.CompanyObject;
import kz.eco.company.CompanyObjectRepository;
import kz.eco.company.CompanyRepository;
import kz.eco.company.CompanyStatus;
import kz.eco.pek.dto.PekApiDtos;
import kz.eco.protocol.Protocol;
import kz.eco.protocol.ProtocolRepository;
import kz.eco.protocol.ProtocolStatus;
import kz.eco.protocol.ProtocolTemplate;
import kz.eco.protocol.ProtocolTemplateRepository;
import kz.eco.protocol.dto.ProtocolApiDtos;
import kz.eco.user.ClientType;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import kz.eco.user.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Transactional
class PekProtocolLinkIntegrationTest {

    @Autowired
    private PekProtocolLinkService pekProtocolLinkService;

    @Autowired
    private ProtocolRepository protocolRepository;

    @Autowired
    private ProtocolTemplateRepository templateRepository;

    @Autowired
    private PekProgramRepository programRepository;

    @Autowired
    private PekReportRepository reportRepository;

    @Autowired
    private PekProgramControlItemRepository controlItemRepository;

    @Autowired
    private PekReportProtocolSourceRepository sourceRepository;

    @Autowired
    private CompanyRepository companyRepository;

    @Autowired
    private CompanyObjectRepository companyObjectRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private Long userId;
    private Long companyId;
    private Long objectId;
    private Long protocolId;
    private Long programId;
    private Long reportId;
    private Long controlItemId;

    @BeforeEach
    void setUp() {
        // Create user
        User user = new User();
        user.setEmail("pek-test-" + System.nanoTime() + "@ecoprogress.kz");
        user.setPasswordHash(passwordEncoder.encode("demo123"));
        user.setName("PEK Tester");
        // PekProtocolLinkService now checks PekAccessService.requireCompanyAccess via
        // CurrentUser.get() (module fix) - ADMIN has global PEK access with no company
        // membership needed, so this direct-service test isn't exercising that access check.
        user.setRole(UserRole.ADMIN);
        user.setType(ClientType.staff);
        userRepository.save(user);
        userId = user.getId();
        org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(
                new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(
                        user, null,
                        List.of(new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_ADMIN"))));

        // Create company
        Company company = new Company();
        company.setName("ТОО Test PEK");
        company.setBin("001122334455");
        company.setLegalAddress("Test address");
        company.setPhone("+77000000000");
        company.setStatus(CompanyStatus.ACTIVE);
        company.setObjectName("Test Object");
        companyRepository.save(company);
        companyId = company.getId();

        // Create object
        CompanyObject object = new CompanyObject();
        object.setCompanyId(companyId);
        object.setName("Test Object");
        object.setAddress("Test address");
        object.setActivityType("Manufacturing");
        object.setStatus("ACTIVE");
        companyObjectRepository.save(object);
        objectId = object.getId();

        // Create template
        ProtocolTemplate template = new ProtocolTemplate();
        template.setCode("WATER_TEST_" + System.nanoTime());
        template.setName("Water Test");
        template.setActive(true);
        templateRepository.save(template);

        // Create protocol (DRAFT)
        Protocol protocol = new Protocol();
        protocol.setTemplateId(template.getId());
        protocol.setTemplateCode(template.getCode());
        protocol.setProtocolNumber("TEST-001-" + System.nanoTime());
        protocol.setProtocolDate(LocalDate.now());
        protocol.setCompanyId(companyId);
        protocol.setObjectId(objectId);
        protocol.setStatus(ProtocolStatus.DRAFT);
        protocol.setCreatedBy(userId);
        protocolRepository.save(protocol);
        protocolId = protocol.getId();

        // Create PEK program
        PekProgram program = new PekProgram();
        program.setCompanyId(companyId);
        program.setObjectId(objectId);
        program.setNumber("PROG-" + System.nanoTime());
        program.setName("Test Program");
        program.setStatus(PekProgramStatus.DRAFT);
        program.setValidFrom(LocalDate.of(2026, 1, 1));
        program.setValidUntil(LocalDate.of(2026, 12, 31));
        program.setCreatedBy(userId);
        programRepository.save(program);
        programId = program.getId();

        // Create PEK report
        PekReport report = new PekReport();
        report.setProgramId(programId);
        report.setCompanyId(companyId);
        report.setObjectId(objectId);
        report.setPeriodType(PekPeriodType.QUARTER);
        report.setReportYear(2026);
        report.setReportQuarter(1);
        report.computePeriodKey();
        report.setPeriodStart(LocalDate.of(2026, 1, 1));
        report.setPeriodEnd(LocalDate.of(2026, 3, 31));
        report.setStatus(PekReportStatus.COLLECTING);
        report.setCreatedBy(userId);
        reportRepository.save(report);
        reportId = report.getId();

        // Create control item
        PekProgramControlItem controlItem = new PekProgramControlItem();
        controlItem.setProgramId(programId);
        controlItem.setCode("CI-001");
        controlItem.setName("Test Control Item");
        controlItem.setControlType(PekControlType.WASTEWATER);
        controlItem.setEnvironmentComponent("WATER");
        controlItem.setFrequencyType(PekFrequencyType.QUARTERLY);
        controlItemRepository.save(controlItem);
        controlItemId = controlItem.getId();
    }

    @Test
    void testCreatePekLinkFromProtocolContext() {
        // Create link from protocol side with full PEK context
        PekApiDtos.CreateProtocolPekLinkRequest request = new PekApiDtos.CreateProtocolPekLinkRequest(
                programId,
                reportId,
                controlItemId,
                null,  // programIndicatorId
                null,  // controlEventId
                null,  // monitoringPointId
                null,  // emissionSourceId
                null,  // waterOutletId
                "order-123",
                "service-item-456",
                "client-link-id-1"
        );

        PekApiDtos.ProtocolLinkResponse response = pekProtocolLinkService.createFromPekContext(protocolId, request, userId);

        assertNotNull(response);
        assertEquals(protocolId, response.protocolId());
        assertEquals(reportId, response.reportId());
        assertEquals(programId, response.programId());
        assertEquals(controlItemId, response.controlItemId());
        assertEquals("order-123", response.orderId());
        assertEquals("service-item-456", response.orderServiceItemId());
        assertEquals("MANUAL", response.matchType());
        assertEquals("MATCHED", response.matchStatus());
        assertNotNull(response.id());
    }

    @Test
    void testCreatePekLinkIdempotent() {
        // Create link
        PekApiDtos.CreateProtocolPekLinkRequest request = new PekApiDtos.CreateProtocolPekLinkRequest(
                programId,
                reportId,
                controlItemId,
                null, null, null, null, null,
                "order-123",
                "service-item-456",
                "client-link-id-1"
        );

        PekApiDtos.ProtocolLinkResponse response1 = pekProtocolLinkService.createFromPekContext(protocolId, request, userId);
        PekApiDtos.ProtocolLinkResponse response2 = pekProtocolLinkService.createFromPekContext(protocolId, request, userId);

        // Should return the same link ID
        assertEquals(response1.id(), response2.id());

        // Should not create duplicate in database
        long count = sourceRepository.findByReportIdAndProtocolIdAndProtocolResultIdIsNull(reportId, protocolId)
                .map(l -> 1L).orElse(0L);
        assertEquals(1L, count);
    }

    @Test
    void testUpdatePekLink() {
        // Create link
        PekApiDtos.CreateProtocolPekLinkRequest createRequest = new PekApiDtos.CreateProtocolPekLinkRequest(
                programId,
                reportId,
                controlItemId,
                null, null, null, null, null,
                "order-123",
                "service-item-456",
                "client-link-id-1"
        );

        PekApiDtos.ProtocolLinkResponse createdLink = pekProtocolLinkService.createFromPekContext(protocolId, createRequest, userId);

        // Update link
        PekApiDtos.UpdateProtocolPekLinkRequest updateRequest = new PekApiDtos.UpdateProtocolPekLinkRequest(
                null,  // keep controlItemId
                null,  // programIndicatorId
                null,  // no controlEventId
                null,  // no monitoringPointId
                null,  // no emissionSourceId
                null,  // no waterOutletId
                "order-456",  // update orderId
                "service-item-789"  // update orderServiceItemId
        );

        PekApiDtos.ProtocolLinkResponse updatedLink = pekProtocolLinkService.update(protocolId, createdLink.id(), updateRequest, createdLink.version(), userId);

        assertEquals("order-456", updatedLink.orderId());
        assertEquals("service-item-789", updatedLink.orderServiceItemId());
        assertEquals(createdLink.id(), updatedLink.id());
    }

    @Test
    void testUpdatePekLinkVersionConflict() {
        // Create link
        PekApiDtos.CreateProtocolPekLinkRequest createRequest = new PekApiDtos.CreateProtocolPekLinkRequest(
                programId,
                reportId,
                controlItemId,
                null, null, null, null, null,
                "order-123",
                "service-item-456",
                "client-link-id-1"
        );

        PekApiDtos.ProtocolLinkResponse createdLink = pekProtocolLinkService.createFromPekContext(protocolId, createRequest, userId);

        // Try to update with wrong version
        PekApiDtos.UpdateProtocolPekLinkRequest updateRequest = new PekApiDtos.UpdateProtocolPekLinkRequest(
                null, null, null, null, null, null,
                "order-456",
                "service-item-789"
        );

        assertThrows(Exception.class, () ->
                pekProtocolLinkService.update(protocolId, createdLink.id(), updateRequest, createdLink.version() + 1, userId)
        );
    }

    @Test
    void testListProtocolsByProgram() {
        // Create link
        PekApiDtos.CreateProtocolPekLinkRequest request = new PekApiDtos.CreateProtocolPekLinkRequest(
                programId, reportId, controlItemId, null, null, null, null, null,
                "order-123", "service-item-456", "client-link-id-1"
        );

        pekProtocolLinkService.createFromPekContext(protocolId, request, userId);

        // List protocols by program
        List<PekApiDtos.ProtocolLinkResponse> protocols = pekProtocolLinkService.listByProgram(programId);

        assertEquals(1, protocols.size());
        assertEquals(protocolId, protocols.get(0).protocolId());
    }

    @Test
    void testListProtocolsByReport() {
        // Create link
        PekApiDtos.CreateProtocolPekLinkRequest request = new PekApiDtos.CreateProtocolPekLinkRequest(
                programId, reportId, controlItemId, null, null, null, null, null,
                "order-123", "service-item-456", "client-link-id-1"
        );

        pekProtocolLinkService.createFromPekContext(protocolId, request, userId);

        // List protocols by report
        List<PekApiDtos.ProtocolLinkResponse> protocols = pekProtocolLinkService.listByReport(reportId);

        assertEquals(1, protocols.size());
        assertEquals(protocolId, protocols.get(0).protocolId());
        assertEquals(reportId, protocols.get(0).reportId());
    }

    @Test
    void testListProtocolsByControlItem() {
        // Create link
        PekApiDtos.CreateProtocolPekLinkRequest request = new PekApiDtos.CreateProtocolPekLinkRequest(
                programId, reportId, controlItemId, null, null, null, null, null,
                "order-123", "service-item-456", "client-link-id-1"
        );

        pekProtocolLinkService.createFromPekContext(protocolId, request, userId);

        // List protocols by control item
        List<PekApiDtos.ProtocolLinkResponse> protocols = pekProtocolLinkService.listByControlItem(controlItemId);

        assertEquals(1, protocols.size());
        assertEquals(controlItemId, protocols.get(0).controlItemId());
    }

    @Test
    void testCreatePekLinkWithMissingContext() {
        // Try to create link with no PEK context
        PekApiDtos.CreateProtocolPekLinkRequest request = new PekApiDtos.CreateProtocolPekLinkRequest(
                null, null, null, null, null, null, null, null,
                "order-123", "service-item-456", "client-link-id-1"
        );

        assertThrows(BadRequestException.class, () ->
                pekProtocolLinkService.createFromPekContext(protocolId, request, userId)
        );
    }

    @Test
    void testCreatePekLinkCompanyScopeMismatch() {
        // Create another company
        Company otherCompany = new Company();
        otherCompany.setName("ТОО Other");
        otherCompany.setBin("999888777666");
        otherCompany.setLegalAddress("Other address");
        otherCompany.setPhone("+77111111111");
        otherCompany.setStatus(CompanyStatus.ACTIVE);
        otherCompany.setObjectName("Other Object");
        companyRepository.save(otherCompany);

        // Create object for other company
        CompanyObject otherObject = new CompanyObject();
        otherObject.setCompanyId(otherCompany.getId());
        otherObject.setName("Other Object");
        otherObject.setAddress("Other address");
        otherObject.setActivityType("Manufacturing");
        otherObject.setStatus("ACTIVE");
        companyObjectRepository.save(otherObject);

        // Create program for other company
        PekProgram otherProgram = new PekProgram();
        otherProgram.setCompanyId(otherCompany.getId());
        otherProgram.setObjectId(otherObject.getId());
        otherProgram.setNumber("PROG-OTHER-" + System.nanoTime());
        otherProgram.setName("Other Program");
        otherProgram.setStatus(PekProgramStatus.DRAFT);
        otherProgram.setValidFrom(LocalDate.of(2026, 1, 1));
        otherProgram.setValidUntil(LocalDate.of(2026, 12, 31));
        otherProgram.setCreatedBy(userId);
        programRepository.save(otherProgram);

        // Try to link protocol (companyId) with program (otherCompany.id)
        PekApiDtos.CreateProtocolPekLinkRequest request = new PekApiDtos.CreateProtocolPekLinkRequest(
                otherProgram.getId(),
                null,
                null,
                null, null, null, null, null,
                "order-123", "service-item-456", "client-link-id-1"
        );

        assertThrows(BadRequestException.class, () ->
                pekProtocolLinkService.createFromPekContext(protocolId, request, userId)
        );
    }

    @Test
    void testDeletePekLink() {
        // Create link
        PekApiDtos.CreateProtocolPekLinkRequest request = new PekApiDtos.CreateProtocolPekLinkRequest(
                programId, reportId, controlItemId, null, null, null, null, null,
                "order-123", "service-item-456", "client-link-id-1"
        );

        PekApiDtos.ProtocolLinkResponse createdLink = pekProtocolLinkService.createFromPekContext(protocolId, request, userId);

        // Delete link
        pekProtocolLinkService.delete(protocolId, createdLink.id());

        // Verify it's deleted
        List<PekApiDtos.ProtocolLinkResponse> links = pekProtocolLinkService.list(protocolId);
        assertEquals(0, links.size());
    }

    @Test
    void testCreateDraftWithPekContext() {
        // This test would require ProtocolService integration
        // and would test the full flow from protocol creation with PEK context
        // Implementation depends on full integration of ProtocolService changes
    }
}
