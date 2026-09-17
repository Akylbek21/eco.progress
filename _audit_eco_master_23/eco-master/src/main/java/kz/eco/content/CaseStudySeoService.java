package kz.eco.content;

import kz.eco.news.dto.NewsSeoDto;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class CaseStudySeoService {

    private final String baseUrl;

    public CaseStudySeoService(@Value("${eco.public.base-url}") String baseUrl) {
        this.baseUrl = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
    }

    public String robots(CaseStudy c) {
        return c.isIndexable() ? "index,follow" : "noindex,follow";
    }

    public String canonicalUrl(CaseStudy c) {
        return baseUrl + "/cases/" + c.getId();
    }

    public NewsSeoDto seo(CaseStudy c) {
        Map<String, Object> ld = new LinkedHashMap<>();
        ld.put("@context", "https://schema.org");
        ld.put("@type", "Article");
        ld.put("headline", c.getTitle());
        ld.put("description", c.getSummary());
        if (c.getImage() != null) {
            ld.put("image", c.getImage().startsWith("http") ? c.getImage() : baseUrl + c.getImage());
        }
        if (c.getUpdatedAt() != null) {
            ld.put("dateModified", DateTimeFormatter.ISO_INSTANT.format(c.getUpdatedAt()));
        }
        Map<String, Object> publisher = new LinkedHashMap<>();
        publisher.put("@type", "Organization");
        publisher.put("name", "ECOPROGRESS GROUP");
        publisher.put("url", baseUrl);
        ld.put("publisher", publisher);
        ld.put("mainEntityOfPage", canonicalUrl(c));
        return new NewsSeoDto(robots(c), canonicalUrl(c), ld);
    }
}
