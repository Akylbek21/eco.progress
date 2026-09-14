package kz.eco.services;

import kz.eco.news.dto.NewsSeoDto;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;

/** Same "single source of truth for the robots directive" role as kz.eco.news.NewsSeoService /
 *  kz.eco.content.ServiceCitySeoService, for the catalogue-level EcoService#isIndexable(). */
@Service
public class EcoServiceSeoService {

    private final String baseUrl;

    public EcoServiceSeoService(@Value("${eco.public.base-url}") String baseUrl) {
        this.baseUrl = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
    }

    public String robots(EcoService service) {
        return service.isIndexable() ? "index,follow" : "noindex,follow";
    }

    public String canonicalUrl(EcoService service) {
        return baseUrl + "/uslugi/" + service.getId();
    }

    public NewsSeoDto seo(EcoService service) {
        Map<String, Object> ld = new LinkedHashMap<>();
        ld.put("@context", "https://schema.org");
        ld.put("@type", "Service");
        ld.put("name", service.getTitle());
        ld.put("description", service.getDescription());
        Map<String, Object> provider = new LinkedHashMap<>();
        provider.put("@type", "Organization");
        provider.put("name", "ECOPROGRESS GROUP");
        provider.put("url", baseUrl);
        ld.put("provider", provider);
        ld.put("mainEntityOfPage", canonicalUrl(service));
        return new NewsSeoDto(robots(service), canonicalUrl(service), ld);
    }
}
