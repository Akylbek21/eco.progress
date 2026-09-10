package kz.eco.news;

import kz.eco.common.ApiResponse;
import kz.eco.news.dto.NewsResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Public, unauthenticated surface - see SecurityConfig's permitAll matcher for /api/news/** and
 *  /api/public/content/**. Both /api/news (legacy) and /api/public/content/articles (unified CMS
 *  contract) are served by these exact same handler methods - one implementation, not two that
 *  could silently drift apart. Editorial (review-workflow) endpoints live in
 *  {@link NewsReviewController}. */
@RestController
@RequestMapping({"/api/news", "/api/public/content/articles"})
public class NewsController {

    private final NewsService service;

    public NewsController(NewsService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<List<NewsResponse>> list() {
        return ApiResponse.ok(service.findAll());
    }

    @GetMapping("/{id}")
    public ApiResponse<NewsResponse> get(@PathVariable String id) {
        return ApiResponse.ok(service.findById(id));
    }
}
