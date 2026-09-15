package kz.eco.content;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** robots.txt (Infrastructure item 1) - explicitly allows OAI-SearchBot (ChatGPT search crawler)
 *  alongside the general-purpose Allow, and blocks every closed CRM surface. Note: if the public
 *  website is served by a separate frontend/CDN rather than this API origin, that layer must also
 *  serve this same policy at its own /robots.txt - this endpoint only covers requests that reach
 *  this backend directly. Actual nginx/CDN/WAF rules that might 403/429/challenge OAI-SearchBot
 *  live outside this repository and could not be verified or changed here - see Infrastructure
 *  item 1's "проверить, чтобы nginx/CDN/WAF не возвращали..." requirement. */
@RestController
public class RobotsController {

    private final String baseUrl;

    public RobotsController(@Value("${eco.public.base-url}") String baseUrl) {
        this.baseUrl = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
    }

    /** robots.txt applies only the MOST SPECIFIC matching User-agent block to a given bot - rules
     *  are never inherited/merged from the "*" block. So every named crawler gets its own explicit
     *  copy of the closed-surface Disallow list; without this, giving OAI-SearchBot a bare
     *  "Allow: /" would silently permit it to crawl /admin, /api etc, which is exactly what must
     *  NOT happen ("не открывать административные/API endpoints только ради AI crawlers"). */
    private static final String CLOSED_SURFACES = """
            Disallow: /admin
            Disallow: /staff
            Disallow: /client
            Disallow: /api
            """;

    @GetMapping(value = "/robots.txt", produces = MediaType.TEXT_PLAIN_VALUE)
    public String robots() {
        return """
                User-agent: *
                %1$s
                User-agent: OAI-SearchBot
                %1$s
                Allow: /

                User-agent: Googlebot
                %1$s
                Allow: /

                User-agent: Bingbot
                %1$s
                Allow: /

                Sitemap: %2$s/sitemap.xml
                """.formatted(CLOSED_SURFACES, baseUrl);
    }
}
