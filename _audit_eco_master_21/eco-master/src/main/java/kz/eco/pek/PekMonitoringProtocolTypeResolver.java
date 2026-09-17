package kz.eco.pek;
import kz.eco.protocol.ProtocolTemplateCode;
import org.springframework.stereotype.Component;
import java.util.List;
@Component
public class PekMonitoringProtocolTypeResolver {
    public List<ProtocolTemplateCode> resolve(PekMonitoringType type) {
        return switch (type) {
            case AMBIENT_AIR -> List.of(ProtocolTemplateCode.AMBIENT_AIR_SZZ);
            case EMISSION_SOURCE -> List.of(ProtocolTemplateCode.INDUSTRIAL_EMISSIONS);
            case SURFACE_WATER, GROUNDWATER, WASTEWATER -> List.of(ProtocolTemplateCode.WATER_WASTEWATER);
            case SOIL -> List.of(ProtocolTemplateCode.SOIL);
            case PHYSICAL_FACTOR -> List.of(ProtocolTemplateCode.NOISE_VIBRATION, ProtocolTemplateCode.MICROCLIMATE,
                    ProtocolTemplateCode.LIGHTING, ProtocolTemplateCode.UV_EMF_LASER);
            case WASTE -> List.of(); // no separate Protocol template exists; results remain linked through PEK context
        };
    }
}
