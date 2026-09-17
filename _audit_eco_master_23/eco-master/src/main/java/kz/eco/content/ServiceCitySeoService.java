package kz.eco.content;

import kz.eco.news.dto.NewsSeoDto;
import kz.eco.services.EcoService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Same "single source of truth for the robots directive" role as kz.eco.news.NewsSeoService, but
 *  for ServiceCityPage#isIndexable() (the three-way pageStatus/regionContentStatus/
 *  contentQualityPassed gate) instead of News' simpler reviewStatus check. */
@Service
public class ServiceCitySeoService {

    private final String baseUrl;

    public ServiceCitySeoService(@Value("${eco.public.base-url}") String baseUrl) {
        this.baseUrl = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
    }

    public String robots(ServiceCityPage page) {
        return page.isIndexable() ? "index,follow" : "noindex,follow";
    }

    public String canonicalUrl(ServiceCityPage page) {
        return baseUrl + "/uslugi/" + page.getServiceId() + "/" + page.getCitySlug();
    }

    public NewsSeoDto seo(ServiceCityPage page, EcoService service, City city) {
        return new NewsSeoDto(robots(page), canonicalUrl(page), jsonLd(page, service, city));
    }

    private Map<String, Object> jsonLd(ServiceCityPage page, EcoService service, City city) {
        Map<String, Object> ld = new LinkedHashMap<>();
        ld.put("@context", "https://schema.org");
        ld.put("@type", "Service");
        if (service != null) {
            ld.put("name", service.getTitle() + (city != null ? " в " + city.getPrepositional() : ""));
            ld.put("description", service.getDescription());
        }
        if (city != null) {
            Map<String, Object> area = new LinkedHashMap<>();
            area.put("@type", "City");
            area.put("name", city.getNominative());
            ld.put("areaServed", area);
        }
        Map<String, Object> provider = new LinkedHashMap<>();
        provider.put("@type", "Organization");
        provider.put("name", "ECOPROGRESS GROUP");
        provider.put("url", baseUrl);
        ld.put("provider", provider);
        ld.put("mainEntityOfPage", canonicalUrl(page));

        if (!page.getLocalFaq().isEmpty()) {
            Map<String, Object> faqPage = new LinkedHashMap<>();
            faqPage.put("@type", "FAQPage");
            faqPage.put("mainEntity", page.getLocalFaq().stream().map(item -> {
                Map<String, Object> question = new LinkedHashMap<>();
                question.put("@type", "Question");
                question.put("name", item.getQuestion());
                Map<String, Object> answer = new LinkedHashMap<>();
                answer.put("@type", "Answer");
                answer.put("text", item.getAnswer());
                question.put("acceptedAnswer", answer);
                return question;
            }).toList());
            ld.put("mainEntity", List.of(faqPage));
        }
        return ld;
    }
}
