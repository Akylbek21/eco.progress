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
import org.springframework.web.bind.annotation.PatchMapping;
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

    public record UpdateCounterpartyRequest(String name, String bin, String email, String phone,
                                             String address, Long expectedVersion) {
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

    /** Module spec §15: {@code query}/{@code status}/{@code sort} are additive - omitting them
     *  keeps the exact previous unfiltered-list behavior (same underlying repository call when
     *  query is blank and status is null), so existing callers are unaffected. */
    @GetMapping
    public ApiResponse<PageResponse<Counterparty>> list(@RequestParam(required = false) Long organizationId,
                                                          @RequestParam(required = false) String query,
                                                          @RequestParam(required = false) CounterpartyStatus status,
                                                          @RequestParam(defaultValue = "0") int page,
                                                          @RequestParam(defaultValue = "20") int size,
                                                          @RequestParam(required = false, defaultValue = "name,asc") String sort) {
        User user = CurrentUser.get();
        Long resolvedOrgId = organizationResolver.resolve(user.getId(), organizationId);
        if ((query == null || query.isBlank()) && status == null) {
            return ApiResponse.ok(counterpartyService.list(user.getId(), resolvedOrgId, PageRequest.of(page, size)));
        }
        String[] sortParts = sort.split(",");
        var direction = sortParts.length > 1 && "desc".equalsIgnoreCase(sortParts[1])
                ? org.springframework.data.domain.Sort.Direction.DESC : org.springframework.data.domain.Sort.Direction.ASC;
        String sortField = "bin".equalsIgnoreCase(sortParts[0]) ? "bin" : "name";
        var pageable = PageRequest.of(page, size, org.springframework.data.domain.Sort.by(direction, sortField));
        return ApiResponse.ok(counterpartyService.search(user.getId(), resolvedOrgId, query, status, pageable));
    }

    @GetMapping("/{id}")
    public ApiResponse<Counterparty> get(@PathVariable Long id, @RequestParam(required = false) Long organizationId) {
        User user = CurrentUser.get();
        Long resolvedOrgId = organizationResolver.resolve(user.getId(), organizationId);
        return ApiResponse.ok(counterpartyService.get(user.getId(), resolvedOrgId, id));
    }

    @PatchMapping("/{id}")
    public ApiResponse<Counterparty> update(@PathVariable Long id,
                                            @RequestParam(required = false) Long organizationId,
                                            @RequestBody UpdateCounterpartyRequest request) {
        User user = CurrentUser.get();
        Long resolvedOrgId = organizationResolver.resolve(user.getId(), organizationId);
        return ApiResponse.ok(counterpartyService.update(user.getId(), resolvedOrgId, id, request));
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
