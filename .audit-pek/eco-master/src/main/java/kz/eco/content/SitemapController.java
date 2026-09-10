package kz.eco.content;

import kz.eco.news.News;
import kz.eco.news.NewsRepository;
import kz.eco.news.NewsSeoService;
import kz.eco.services.EcoService;
import kz.eco.services.EcoServiceRepository;
import kz.eco.services.EcoServiceSeoService;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;

/** sitemap.xml - unified source of truth for every indexable URL. Computed live on every read so
 *  that revoking approval or disabling a service drops the URL on the very next crawl, with no
 *  separate cache/flag to clear. Covers: News articles, ServiceCityPages, CaseStudies, and the
 *  EcoService catalogue pages (all four share the same isIndexable() contract). */
@RestController
public class SitemapController {

    private final NewsRepository newsRepository;
    private final NewsSeoService newsSeoService;
    private final ServiceCityPageRepository pageRepository;
    private final ServiceCitySeoService citySeoService;
    private final CaseStudyRepository caseStudyRepository;
    private final CaseStudySeoService caseStudySeoService;
    private final EcoServiceRepository ecoServiceRepository;
    private final EcoServiceSeoService ecoServiceSeoService;

    public SitemapController(NewsRepository newsRepository, NewsSeoService newsSeoService,
                              ServiceCityPageRepository pageRepository, ServiceCitySeoService citySeoService,
                              CaseStudyRepository caseStudyRepository, CaseStudySeoService caseStudySeoService,
                              EcoServiceRepository ecoServiceRepository, EcoServiceSeoService ecoServiceSeoService) {
        this.newsRepository = newsRepository;
        this.newsSeoService = newsSeoService;
        this.pageRepository = pageRepository;
        this.citySeoService = citySeoService;
        this.caseStudyRepository = caseStudyRepository;
        this.caseStudySeoService = caseStudySeoService;
        this.ecoServiceRepository = ecoServiceRepository;
        this.ecoServiceSeoService = ecoServiceSeoService;
    }

    @GetMapping(value = "/sitemap.xml", produces = MediaType.APPLICATION_XML_VALUE)
    public String sitemap() {
        List<News> indexableNews = newsRepository.findAllByReviewStatusInOrderByPublishedAtDesc(
                List.of(ContentStatus.APPROVED, ContentStatus.PUBLISHED));
        List<ServiceCityPage> indexablePages = pageRepository.findAllByContentStatusAndContentQualityPassedTrue(
                ContentStatus.PUBLISHED);
        List<CaseStudy> indexableCases = caseStudyRepository.findAllByContentStatusInOrderByUpdatedAtDesc(
                List.of(ContentStatus.APPROVED, ContentStatus.PUBLISHED));
        List<EcoService> indexableServices = ecoServiceRepository.findAllByIsActiveTrueAndContentStatusInOrderByTitleAsc(
                List.of(ContentStatus.APPROVED, ContentStatus.PUBLISHED));

        StringBuilder xml = new StringBuilder();
        xml.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        xml.append("<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n");
        for (News news : indexableNews) {
            url(xml, newsSeoService.canonicalUrl(news), news.getUpdatedAt());
        }
        for (ServiceCityPage page : indexablePages) {
            url(xml, citySeoService.canonicalUrl(page), page.getUpdatedAt());
        }
        for (CaseStudy c : indexableCases) {
            url(xml, caseStudySeoService.canonicalUrl(c), c.getUpdatedAt());
        }
        for (EcoService s : indexableServices) {
            java.time.Instant updatedAt = s.getUpdatedAt() == null ? null
                    : s.getUpdatedAt().atZone(ZoneOffset.UTC).toInstant();
            url(xml, ecoServiceSeoService.canonicalUrl(s), updatedAt);
        }
        xml.append("</urlset>\n");
        return xml.toString();
    }

    private void url(StringBuilder xml, String loc, java.time.Instant updatedAt) {
        xml.append("  <url>\n");
        xml.append("    <loc>").append(escape(loc)).append("</loc>\n");
        if (updatedAt != null) {
            xml.append("    <lastmod>").append(DateTimeFormatter.ISO_INSTANT.format(updatedAt)).append("</lastmod>\n");
        }
        xml.append("  </url>\n");
    }

    private String escape(String value) {
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                .replace("\"", "&quot;").replace("'", "&apos;");
    }
}
