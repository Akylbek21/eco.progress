package kz.ecoprogress.documentflow.counterparty;

import kz.eco.auth.CurrentUser;
import kz.eco.common.ApiResponse;
import kz.eco.common.PageResponse;
import kz.eco.user.User;
import kz.ecoprogress.documentflow.access.OrganizationResolver;
import org.springframework.data.domain.PageRequest;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/document-flow/counterparties")
public class CounterpartyController {

    private final CounterpartyService counterpartyService;
    private final OrganizationResolver organizationResolver;

    public CounterpartyController(CounterpartyService counterpartyService, OrganizationResolver organizationResolver) {
        this.counterpartyService = counterpartyService;
        this.organizationResolver = organizationResolver;
    }

    public record CreateCounterpartyRequest(String bin, String name, Long linkedOrganizationId,
                                             String directorName, String address, String email, String phone) {
    }

    public record CreateRepresentativeRequest(String fullName, String position, String email, String phone) {
    }

    @PostMapping
    public ApiResponse<Counterparty> create(@RequestParam(required = false) Long organizationId,
                                             @RequestBody CreateCounterpartyRequest request) {
        User user = CurrentUser.get();
        Long resolvedOrgId = organizationResolver.resolve(user.getId(), organizationId);
        Counterparty counterparty = counterpartyService.create(user.getId(), resolvedOrgId, request.bin(), request.name(),
                request.linkedOrganizationId(), request.directorName(), request.address(), request.email(), request.phone());
        return ApiResponse.ok(counterparty);
    }

    @GetMapping
    public ApiResponse<PageResponse<Counterparty>> list(@RequestParam(required = false) Long organizationId,
                                                          @RequestParam(defaultValue = "0") int page,
                                                          @RequestParam(defaultValue = "20") int size) {
        User user = CurrentUser.get();
        Long resolvedOrgId = organizationResolver.resolve(user.getId(), organizationId);
        return ApiResponse.ok(counterpartyService.list(user.getId(), resolvedOrgId, PageRequest.of(page, size)));
    }

    @GetMapping("/{id}")
    public ApiResponse<Counterparty> get(@PathVariable Long id, @RequestParam(required = false) Long organizationId) {
        User user = CurrentUser.get();
        Long resolvedOrgId = organizationResolver.resolve(user.getId(), organizationId);
        return ApiResponse.ok(counterpartyService.get(user.getId(), resolvedOrgId, id));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Counterparty> archive(@PathVariable Long id, @RequestParam(required = false) Long organizationId) {
        User user = CurrentUser.get();
        Long resolvedOrgId = organizationResolver.resolve(user.getId(), organizationId);
        return ApiResponse.ok(counterpartyService.archive(user.getId(), resolvedOrgId, id));
    }

    @PostMapping("/{id}/representatives")
    public ApiResponse<CounterpartyRepresentative> addRepresentative(@PathVariable Long id,
                                                                      @RequestParam(required = false) Long organizationId,
                                                                      @RequestBody CreateRepresentativeRequest request) {
        User user = CurrentUser.get();
        Long resolvedOrgId = organizationResolver.resolve(user.getId(), organizationId);
        return ApiResponse.ok(counterpartyService.addRepresentative(user.getId(), resolvedOrgId, id,
                request.fullName(), request.position(), request.email(), request.phone()));
    }

    @GetMapping("/{id}/representatives")
    public ApiResponse<List<CounterpartyRepresentative>> representatives(@PathVariable Long id,
                                                                          @RequestParam(required = false) Long organizationId) {
        User user = CurrentUser.get();
        Long resolvedOrgId = organizationResolver.resolve(user.getId(), organizationId);
        return ApiResponse.ok(counterpartyService.representatives(user.getId(), resolvedOrgId, id));
    }
}
