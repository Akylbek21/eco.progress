package kz.eco.services;

import kz.eco.content.ContentStatus;
import kz.eco.content.FaqItem;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import java.util.List;

import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** AEO structured blocks are stored as discrete fields (not one HTML blob) and returned to the
 *  public API - module fix item 1. */
@SpringBootTest
@Transactional
class EcoServiceAeoFieldsTest {

    @Autowired private WebApplicationContext context;
    @Autowired private EcoServiceRepository repository;

    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    @Test
    void publicDetail_exposesStructuredAeoBlocks() throws Exception {
        EcoService s = new EcoService();
        s.setId("svc-aeo");
        s.setCategory(ServiceCategory.PROJECTING);
        s.setTitle("Проект НДВ");
        s.setDescription("Разработка проекта нормативов допустимых выбросов.");
        s.setContentStatus(ContentStatus.PUBLISHED);
        s.setShortAnswer("Проект НДВ нужен предприятиям II категории с источниками выбросов в атмосферу.");
        s.setWhoNeeds("Промышленные предприятия II категории.");
        s.setWhenRequired("При наличии стационарных источников выбросов.");
        s.setWhenNotRequired("Для объектов IV категории с декларированием.");
        s.setRequiredDocuments(List.of("Инвентаризация источников", "Ситуационный план"));
        s.setCustomerReceives(List.of("Утверждённый проект НДВ"));
        s.setTimeline("2-4 недели");
        s.setPricingFactors(List.of("Количество источников выбросов", "Категория объекта"));
        s.setLegalBasis(List.of("Экологический кодекс РК, статья 111"));
        s.setCommonMistakes(List.of("Отсутствие инвентаризации перед подачей заявки"));
        s.setFaq(List.of(new FaqItem("Сколько действует проект НДВ?", "5 лет с даты утверждения.")));
        repository.save(s);

        mvc.perform(get("/api/services/svc-aeo"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.aeo.shortAnswer").value(org.hamcrest.Matchers.containsString("II категории")))
                .andExpect(jsonPath("$.data.aeo.whoNeeds").exists())
                .andExpect(jsonPath("$.data.aeo.whenRequired").exists())
                .andExpect(jsonPath("$.data.aeo.whenNotRequired").exists())
                .andExpect(jsonPath("$.data.aeo.requiredDocuments.length()").value(2))
                .andExpect(jsonPath("$.data.aeo.customerReceives.length()").value(1))
                .andExpect(jsonPath("$.data.aeo.timeline").value("2-4 недели"))
                .andExpect(jsonPath("$.data.aeo.pricingFactors.length()").value(2))
                .andExpect(jsonPath("$.data.aeo.legalBasis[0]").value("Экологический кодекс РК, статья 111"))
                .andExpect(jsonPath("$.data.aeo.commonMistakes.length()").value(1))
                .andExpect(jsonPath("$.data.aeo.faq[0].question").value("Сколько действует проект НДВ?"));
    }

    @Test
    void publicDetail_availableViaUnifiedContentEndpointToo() throws Exception {
        EcoService s = new EcoService();
        s.setId("svc-aeo2");
        s.setCategory(ServiceCategory.PROJECTING);
        s.setTitle("ПЭК");
        s.setDescription("Разработка программы экологического контроля.");
        s.setContentStatus(ContentStatus.PUBLISHED);
        s.setShortAnswer("ПЭК - обязательная программа контроля воздействия на окружающую среду.");
        repository.save(s);

        mvc.perform(get("/api/public/content/services/svc-aeo2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.aeo.shortAnswer").exists());
    }
}
