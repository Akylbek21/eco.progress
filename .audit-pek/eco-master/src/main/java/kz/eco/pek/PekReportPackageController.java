package kz.eco.pek;
import kz.eco.auth.CurrentUser; import kz.eco.common.ApiResponse; import kz.eco.common.exception.NotFoundException; import kz.eco.pek.dto.PekMonitoringDtos; import kz.eco.storage.*;
import org.springframework.core.io.InputStreamResource; import org.springframework.http.*; import org.springframework.security.access.prepost.PreAuthorize; import org.springframework.web.bind.annotation.*; import java.io.IOException; import java.net.URLEncoder; import java.nio.charset.StandardCharsets;
@RestController @RequestMapping("/api/pek/reports/{id}/package")
public class PekReportPackageController {
 private final PekReportPackageService service;private final PekReportRepository reports;private final PekAccessService access;
 public PekReportPackageController(PekReportPackageService s,PekReportRepository r,PekAccessService a){service=s;reports=r;access=a;}
 @PreAuthorize(PekSecurityExpressions.PEK_VIEW) @GetMapping public ApiResponse<PekMonitoringDtos.PackageResponse> get(@PathVariable Long id){check(id);return ApiResponse.ok(service.latest(id));}
 @PreAuthorize(PekSecurityExpressions.PEK_REPORT_EDIT) @PostMapping("/generate") public ApiResponse<PekMonitoringDtos.PackageResponse> generate(@PathVariable Long id){check(id);return ApiResponse.ok(service.generate(id,CurrentUser.get().getId()),"Комплект ПЭК сформирован");}
 @PreAuthorize(PekSecurityExpressions.PEK_VIEW) @GetMapping("/download") public ResponseEntity<InputStreamResource> download(@PathVariable Long id)throws IOException{check(id);StoredFileContent c=service.download(id);String n=URLEncoder.encode(c.filename(),StandardCharsets.UTF_8).replace("+","%20");return ResponseEntity.ok().contentType(MediaType.parseMediaType(c.contentType())).header(HttpHeaders.CONTENT_DISPOSITION,"attachment; filename*=UTF-8''"+n).body(new InputStreamResource(c.inputStream()));}
 private void check(Long id){PekReport r=reports.findById(id).orElseThrow(()->new NotFoundException("Отчёт ПЭК не найден: "+id));var u=CurrentUser.get();access.requireReportAccess(u.getId(),u.getRole(),r);}
}
