package kz.eco.protocol;

import kz.eco.company.Company;
import kz.eco.company.CompanyObject;
import kz.eco.company.CompanyStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import java.time.LocalDate;

import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Companies created the old way have no company_objects row — their "object" only ever
 * existed as objectName/objectAddress/... columns on the company. Protocol creation must
 * still work for them, using the company itself as a fallback object (objectId == companyId).
 */
@SpringBootTest
@Transactional
class ProtocolCompanyObjectFallbackTest extends ProtocolApiTestSupport {

    @Autowired
    private WebApplicationContext context;

    @Autowired
    private ProtocolRepository protocolRepository;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        seedProtocolFixtures();
        authenticateLabUser();
        mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    @Test
    void createProtocol_withRealCompanyObject_success() throws Exception {
        Company company = newCompany("ТОО С реальным объектом", "990011112222");
        CompanyObject object = newCompanyObject(company.getId(), "Цех №1", "ул. Ленина, 1");

        mockMvc.perform(post("/api/protocols")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(protocolJson(company.getId(), object.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").exists());
    }

    @Test
    void createProtocol_withCompanyIdAsObjectId_redirectsToPrimaryObject() throws Exception {
        // objectId == companyId (the old "virtual object" convention) no longer writes companyId
        // straight into protocol.objectId - it's redirected to the company's real primary
        // CompanyObject instead (see ProtocolService#applyCompanyObjectFallback). A company
        // created through CompanyService.create() always has one; this test builds that row
        // directly since it constructs the Company via the repository, bypassing CompanyService.
        Company company = newCompany("ТОО С основным объектом", "990011113333");
        CompanyObject primary = newCompanyObject(company.getId(), "Производственная площадка", "г. Алматы, промзона №5");
        primary.setPrimary(true);
        companyObjectRepository.save(primary);

        var result = mockMvc.perform(post("/api/protocols")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(protocolJson(company.getId(), company.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andReturn();

        Long protocolId = Long.valueOf(com.jayway.jsonpath.JsonPath.read(
                result.getResponse().getContentAsString(), "$.data.id").toString());
        Protocol protocol = protocolRepository.findById(protocolId).orElseThrow();
        org.junit.jupiter.api.Assertions.assertEquals(primary.getId(), protocol.getObjectId());
        org.junit.jupiter.api.Assertions.assertEquals("Производственная площадка", protocol.getObjectNameSnapshot());
        org.junit.jupiter.api.Assertions.assertEquals("г. Алматы, промзона №5", protocol.getObjectAddressSnapshot());
    }

    @Test
    void createProtocol_withoutAnyCompanyObject_returnsNotFound() throws Exception {
        Company company = newCompany("ТОО Без объекта вообще", "990011114444");
        // deliberately no CompanyObject row at all for this company

        mockMvc.perform(post("/api/protocols")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(protocolJson(company.getId(), company.getId())))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value(
                        "У компании не настроен объект. Добавьте объект компании перед созданием протокола."));
    }

    @Test
    void createProtocol_withWrongObjectId_returnsError() throws Exception {
        Company company = newCompany("ТОО С чужим objectId", "990011115555");

        mockMvc.perform(post("/api/protocols")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(protocolJson(company.getId(), 999_999_999L)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Объект компании не найден"));
    }

    private Company newCompany(String name, String bin) {
        Company company = new Company();
        company.setName(name);
        company.setBin(bin);
        company.setLegalAddress("г. Алматы, ул. Тестовая, 1");
        company.setPhone("+77001112233");
        company.setStatus(CompanyStatus.ACTIVE);
        companyRepository.save(company);
        return company;
    }

    private CompanyObject newCompanyObject(Long companyId, String name, String address) {
        CompanyObject object = new CompanyObject();
        object.setCompanyId(companyId);
        object.setName(name);
        object.setAddress(address);
        object.setActivityType("Производство");
        object.setSamplingLocation(name);
        object.setStatus("ACTIVE");
        companyObjectRepository.save(object);
        return object;
    }

    private String protocolJson(Long companyId, Long objectId) {
        String today = LocalDate.now().toString();
        return """
                {
                  "templateId": "ambient_air_szz",
                  "companyId": %d,
                  "objectId": %d,
                  "protocolDate": "%s",
                  "sampleDate": "%s",
                  "testingStartDate": "%s",
                  "testingEndDate": "%s",
                  "measurementPlace": "Точка отбора",
                  "laboratoryId": %d,
                  "executorId": %d
                }
                """.formatted(companyId, objectId, today, today, today, today, laboratoryId, executorId);
    }
}
