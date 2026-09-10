package kz.eco.crawlerlog;

import kz.eco.common.ApiResponse;
import kz.eco.crawlerlog.dto.CrawlerAccessLogDto;
import kz.eco.user.SecurityExpressions;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Read-only view over the AI/search-crawler access log (Infrastructure item 2) - populated by
 *  {@link CrawlerAccessLogFilter}. Admin-only, same tier as every other /api/admin/** surface. */
@RestController
@RequestMapping("/api/admin/analytics/crawler-logs")
@PreAuthorize(SecurityExpressions.ADMIN_ONLY)
public class CrawlerAccessLogController {

    private final CrawlerAccessLogRepository repository;

    public CrawlerAccessLogController(CrawlerAccessLogRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    public ApiResponse<List<CrawlerAccessLogDto>> list(@RequestParam(required = false) String crawlerName) {
        List<CrawlerAccessLog> logs = crawlerName == null
                ? repository.findAllByOrderByRequestedAtDesc()
                : repository.findAllByCrawlerNameOrderByRequestedAtDesc(crawlerName);
        return ApiResponse.ok(logs.stream().map(CrawlerAccessLogDto::from).toList());
    }
}
