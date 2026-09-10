package kz.eco.normative.dsm138;

import kz.eco.auth.CurrentUser;
import kz.eco.common.ApiResponse;
import kz.eco.normative.dsm138.dto.Dsm138ImportDtos;
import kz.eco.user.SecurityExpressions;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

@RestController
@RequestMapping("/api/normatives/import/dsm-138")
@PreAuthorize(SecurityExpressions.ADMIN_ONLY)
public class Dsm138ImportController {

    private final Dsm138ImportService importService;

    public Dsm138ImportController(Dsm138ImportService importService) {
        this.importService = importService;
    }

    @PostMapping(value = "/preview", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<Dsm138ImportDtos.PreviewResponse> preview(
            @RequestPart("files") List<MultipartFile> files) throws IOException {
        return ApiResponse.ok(importService.preview(files));
    }

    @PostMapping(value = "/confirm", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<Dsm138ImportDtos.ConfirmResponse> confirm(
            @RequestPart("files") List<MultipartFile> files) throws IOException {
        return ApiResponse.ok(importService.confirm(files, CurrentUser.get().getId()), "Импорт ДСМ-138 подтверждён");
    }

    @PostMapping("/rollback/{importBatchId}")
    public ApiResponse<String> rollback(@PathVariable Long importBatchId) {
        importService.rollback(importBatchId);
        return ApiResponse.ok("Импорт отменён", "Импорт ДСМ-138 откачен");
    }
}
