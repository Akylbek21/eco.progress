package kz.eco.news;

import kz.eco.news.dto.NewsAuthorDto;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.Map;

/** Single source of truth for every SEO-facing computed value (robots directive, canonical URL,
 *  Article JSON-LD) - kept out of the DTO/controller so the "only APPROVED/PUBLISHED is
 *  indexable" rule lives in exactly one place and can never be overridden by request input. */
@Service
public class NewsSeoService {

    private final String baseUrl;

    public NewsSeoService(@Value("${eco.public.base-url}") String baseUrl) {
        this.baseUrl = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
    }

    /** "index,follow" only for APPROVED/PUBLISHED, "noindex,follow" for everything else - never
     *  "nofollow": an unreviewed article's links should still be crawlable, only the page itself
     *  must not be indexed. */
    public String robots(News news) {
        return news.isIndexable() ? "index,follow" : "noindex,follow";
    }

    public String canonicalUrl(News news) {
        return baseUrl + "/news/" + news.getId();
    }

    public Map<String, Object> jsonLd(News news, NewsAuthorDto author, NewsAuthorDto reviewer) {
        Map<String, Object> ld = new LinkedHashMap<>();
        ld.put("@context", "https://schema.org");
        ld.put("@type", "Article");
        ld.put("headline", news.getTitle());
        ld.put("description", news.getExcerpt());
        if (news.getImage() != null) {
            ld.put("image", news.getImage().startsWith("http") ? news.getImage() : baseUrl + news.getImage());
        }
        ld.put("datePublished", news.getPublishedAt() == null ? null
                : news.getPublishedAt().atStartOfDay(ZoneOffset.UTC).format(DateTimeFormatter.ISO_OFFSET_DATE_TIME));
        ld.put("dateModified", news.getUpdatedAt() == null ? null
                : DateTimeFormatter.ISO_INSTANT.format(news.getUpdatedAt()));
        if (author != null) {
            Map<String, Object> authorLd = new LinkedHashMap<>();
            authorLd.put("@type", "Person");
            authorLd.put("name", author.name());
            ld.put("author", authorLd);
        }
        Map<String, Object> publisher = new LinkedHashMap<>();
        publisher.put("@type", "Organization");
        publisher.put("name", "ECOPROGRESS GROUP");
        publisher.put("url", baseUrl);
        ld.put("publisher", publisher);
        ld.put("mainEntityOfPage", canonicalUrl(news));
        if (!news.getSources().isEmpty()) {
            ld.put("citation", news.getSources().stream()
                    .map(src -> {
                        Map<String, Object> cite = new LinkedHashMap<>();
                        cite.put("@type", "CreativeWork");
                        cite.put("name", src);
                        if (src.startsWith("http")) {
                            cite.put("url", src);
                        }
                        return cite;
                    })
                    .toList());
        }
        return ld;
    }
}
