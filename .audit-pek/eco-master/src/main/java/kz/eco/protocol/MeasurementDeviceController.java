package kz.eco.protocol;

import kz.eco.common.ApiResponse;
import kz.eco.protocol.dto.ProtocolApiDtos;
import kz.eco.user.SecurityExpressions;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/measurement-devices")
@PreAuthorize(SecurityExpressions.LAB_PROTOCOL)
public class MeasurementDeviceController {

    private final MeasurementDeviceService deviceService;

    public MeasurementDeviceController(MeasurementDeviceService deviceService) {
        this.deviceService = deviceService;
    }

    @GetMapping("/available")
    public ApiResponse<List<ProtocolApiDtos.MeasurementDeviceData>> available() {
        return ApiResponse.ok(deviceService.listAvailable());
    }

    @GetMapping
    public ApiResponse<List<ProtocolApiDtos.MeasurementDeviceData>> list(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status) {
        return ApiResponse.ok(deviceService.list(search, status));
    }

    @PostMapping
    public ApiResponse<ProtocolApiDtos.MeasurementDeviceData> create(@RequestBody ProtocolApiDtos.MeasurementDeviceData request) {
        return ApiResponse.ok(deviceService.create(request), "Прибор создан");
    }

    @PatchMapping("/{id}")
    public ApiResponse<ProtocolApiDtos.MeasurementDeviceData> update(@PathVariable Long id,
                                                                     @RequestBody ProtocolApiDtos.MeasurementDeviceData request) {
        return ApiResponse.ok(deviceService.update(id, request), "Прибор обновлён");
    }

    @PostMapping("/{id}/archive")
    public ApiResponse<ProtocolApiDtos.MeasurementDeviceData> archive(@PathVariable Long id) {
        return ApiResponse.ok(deviceService.archive(id), "Прибор архивирован");
    }
}
