package kz.eco.protocol;

import kz.eco.common.exception.BadRequestException;
import kz.eco.common.exception.NotFoundException;
import kz.eco.protocol.dto.ProtocolApiDtos;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Service
public class NormativeReferenceService {

    private final NormativeReferenceRepository repository;
    private final ProtocolApiMapper mapper;

    public NormativeReferenceService(NormativeReferenceRepository repository, ProtocolApiMapper mapper) {
        this.repository = repository;
        this.mapper = mapper;
    }

    @Transactional(readOnly = true)
    public List<ProtocolApiDtos.NormativeRecord> list(String templateId, String search) {
        return repository.findByActiveTrueOrderByIndicatorNameAsc().stream()
                .filter(n -> templateId == null || templateId.isBlank() || templateId.equals(n.getTemplateCode()))
                .filter(n -> search == null || search.isBlank()
                        || n.getIndicatorName().toLowerCase().contains(search.toLowerCase()))
                .map(mapper::toNormative)
                .toList();
    }

    @Transactional(readOnly = true)
    public ProtocolApiDtos.NormativeSearchResponse search(String templateId, String indicatorName,
                                                          String objectType, String unit, LocalDate date) {
        if (templateId == null || indicatorName == null) {
            throw new BadRequestException("Укажите templateId и indicatorName");
        }
        LocalDate onDate = date != null ? date : LocalDate.now();
        List<NormativeReference> found = repository.searchActive(
                templateId.trim().toLowerCase(), indicatorName.trim(), objectType, unit, onDate);
        if (found.isEmpty()) {
            return new ProtocolApiDtos.NormativeSearchResponse(false, null, "Норматив не найден");
        }
        return new ProtocolApiDtos.NormativeSearchResponse(true, mapper.toNormative(found.getFirst()), null);
    }

    @Transactional
    public ProtocolApiDtos.NormativeRecord create(ProtocolApiDtos.NormativeUpsertRequest request) {
        NormativeReference entity = new NormativeReference();
        apply(entity, request);
        return mapper.toNormative(repository.save(entity));
    }

    @Transactional
    public ProtocolApiDtos.NormativeRecord update(Long id, ProtocolApiDtos.NormativeUpsertRequest request) {
        NormativeReference entity = repository.findById(id)
                .orElseThrow(() -> new NotFoundException("Норматив не найден: " + id));
        apply(entity, request);
        return mapper.toNormative(repository.save(entity));
    }

    @Transactional
    public ProtocolApiDtos.NormativeRecord archive(Long id) {
        NormativeReference entity = repository.findById(id)
                .orElseThrow(() -> new NotFoundException("Норматив не найден: " + id));
        entity.setActive(false);
        return mapper.toNormative(repository.save(entity));
    }

    private void apply(NormativeReference entity, ProtocolApiDtos.NormativeUpsertRequest request) {
        if (request.templateId() != null) entity.setTemplateCode(request.templateId().trim().toLowerCase());
        if (request.researchObject() != null) entity.setObjectType(trim(request.researchObject()));
        if (request.indicator() != null) entity.setIndicatorName(request.indicator().trim());
        if (request.unit() != null) entity.setUnit(trim(request.unit()));
        if (request.normativeType() != null) entity.setNormativeType(NormativeType.valueOf(request.normativeType()));
        if (request.value() != null) entity.setNormativeValue(new BigDecimal(request.value().replace(',', '.')));
        if (request.min() != null) entity.setMinValue(new BigDecimal(request.min().replace(',', '.')));
        if (request.max() != null) entity.setMaxValue(new BigDecimal(request.max().replace(',', '.')));
        if (request.comparisonType() != null) entity.setComparisonType(ComparisonType.fromApi(request.comparisonType()));
        if (request.normativeDocument() != null) entity.setNormativeDocument(trim(request.normativeDocument()));
        if (request.testingMethod() != null) entity.setTestingMethodNd(trim(request.testingMethod()));
        if (request.samplingMethod() != null) entity.setSamplingMethodNd(trim(request.samplingMethod()));
        if (request.validFrom() != null) entity.setActiveFrom(ProtocolApiMapper.parseDate(request.validFrom()));
        if (request.validUntil() != null) entity.setActiveTo(ProtocolApiMapper.parseDate(request.validUntil()));
        if (request.active() != null) entity.setActive(request.active());
    }

    private static String trim(String value) {
        return value != null ? value.trim() : null;
    }
}
