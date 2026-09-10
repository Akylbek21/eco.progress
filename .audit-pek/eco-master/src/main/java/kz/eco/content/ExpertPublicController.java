package kz.eco.content;

import kz.eco.common.ApiResponse;
import kz.eco.content.dto.ExpertPublicDto;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Public, unauthenticated surface - see SecurityConfig's permitAll matcher for
 *  /api/public/content/**. Only VERIFIED experts are returned - admin workflow lives in
 *  {@link ExpertController}. */
@RestController
@RequestMapping("/api/public/content/experts")
public class ExpertPublicController {

    private final ExpertService service;

    public ExpertPublicController(ExpertService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<List<ExpertPublicDto>> list() {
        return ApiResponse.ok(service.findAllVerified());
    }

    @GetMapping("/{id}")
    public ApiResponse<ExpertPublicDto> get(@PathVariable Long id) {
        return ApiResponse.ok(service.findPublicById(id));
    }
}
