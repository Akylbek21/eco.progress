package kz.eco.news;

import kz.eco.common.ApiResponse;
import kz.eco.news.dto.NewsResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/news")
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
