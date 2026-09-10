package kz.eco.pek;

import kz.eco.common.exception.BadRequestException;
import kz.eco.common.exception.ConflictException;
import kz.eco.common.exception.NotFoundException;
import kz.eco.pek.dto.PekProgramSectionDtos.DischargeSourceDto;
import kz.eco.pek.dto.PekProgramSectionDtos.DischargeSourceRequest;
import kz.eco.pek.dto.PekProgramSectionDtos.EmissionSourceDto;
import kz.eco.pek.dto.PekProgramSectionDtos.EmissionSourceRequest;
import kz.eco.pek.dto.PekProgramSectionDtos.WasteItemDto;
import kz.eco.pek.dto.PekProgramSectionDtos.WasteItemRequest;
import kz.eco.pek.dto.PekProgramSectionDtos.WasteMovementDto;
import kz.eco.pek.dto.PekProgramSectionDtos.WasteMovementRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * CRUD for the subject-domain inventories a PEK program declares - emission sources, discharge
 * outlets, waste types - and for the per-period waste movements a report records against them.
 *
 * <p>Kept out of {@link PekProgramSectionsService} deliberately: these are not more
 * structurally-identical little section tables, they are the substantive inventories the
 * environmental tables of a report are built from, and the waste half of it hangs off the report
 * rather than the program.
 *
 * <p>Program-scoped mutations follow the same rules as every other program sub-resource: the
 * program must still be editable, If-Match is mandatory, and {@code contentRevision} is bumped.
 * Report-scoped waste movements follow the report's own editability rules instead.
 */
@Service
public class PekInventoryService {

    private final PekProgramRepository programRepository;
    private final PekReportRepository reportRepository;
    private final PekEmissionSourceRepository emissionSources;
    private final PekDischargeSourceRepository dischargeSources;
    private final PekWasteItemRepository wasteItems;
    private final PekReportWasteMovementRepository wasteMovements;
    private final PekProgramContentRevisionService revisionService;
    private final PekReportContentRevisionService reportRevisionService;

    public PekInventoryService(PekProgramRepository programRepository,
                               PekReportRepository reportRepository,
                               PekEmissionSourceRepository emissionSources,
                               PekDischargeSourceRepository dischargeSources,
                               PekWasteItemRepository wasteItems,
                               PekReportWasteMovementRepository wasteMovements,
                               PekProgramContentRevisionService revisionService,
                               PekReportContentRevisionService reportRevisionService) {
        this.programRepository = programRepository;
        this.reportRepository = reportRepository;
        this.emissionSources = emissionSources;
        this.dischargeSources = dischargeSources;
        this.wasteItems = wasteItems;
        this.wasteMovements = wasteMovements;
        this.revisionService = revisionService;
        this.reportRevisionService = reportRevisionService;
    }

    // ---- emission sources -----------------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<EmissionSourceDto> listEmissionSources(Long programId) {
        program(programId);
        return emissionSources.findByProgramIdOrderBySortOrderAscIdAsc(programId).stream().map(this::dto).toList();
    }

    @Transactional
    public EmissionSourceDto createEmissionSource(Long programId, EmissionSourceRequest r) {
        editable(program(programId));
        PekEmissionSource e = new PekEmissionSource();
        e.setProgramId(programId);
        apply(e, r);
        EmissionSourceDto saved = dto(emissionSources.saveAndFlush(e));
        revisionService.bump(programId);
        return saved;
    }

    @Transactional
    public EmissionSourceDto updateEmissionSource(Long programId, Long id, EmissionSourceRequest r, Long version) {
        editable(program(programId));
        PekEmissionSource e = emissionSources.findByIdAndProgramId(id, programId)
                .orElseThrow(() -> new NotFoundException("Источник выбросов не найден: " + id));
        checkVersion(version, e.getVersion());
        apply(e, r);
        e.setUpdatedAt(LocalDateTime.now());
        EmissionSourceDto saved = dto(emissionSources.saveAndFlush(e));
        revisionService.bump(programId);
        return saved;
    }

    @Transactional
    public void deleteEmissionSource(Long programId, Long id, Long version) {
        editable(program(programId));
        PekEmissionSource e = emissionSources.findByIdAndProgramId(id, programId)
                .orElseThrow(() -> new NotFoundException("Источник выбросов не найден: " + id));
        checkVersion(version, e.getVersion());
        emissionSources.delete(e);
        revisionService.bump(programId);
    }

    private void apply(PekEmissionSource e, EmissionSourceRequest r) {
        if (isBlank(r.code())) throw new BadRequestException("Укажите номер источника выбросов");
        if (isBlank(r.name())) throw new BadRequestException("Укажите наименование источника выбросов");
        e.setCode(r.code().trim());
        e.setName(r.name().trim());
        e.setSourceType(trimToNull(r.sourceType()));
        e.setWorkshopName(trimToNull(r.workshopName()));
        e.setHeightM(decimal(r.heightM(), "высота источника"));
        e.setDiameterM(decimal(r.diameterM(), "диаметр устья"));
        e.setCoordinates(trimToNull(r.coordinates()));
        e.setGasCleaningEquipment(trimToNull(r.gasCleaningEquipment()));
        e.setCleaningEfficiencyPercent(percent(r.cleaningEfficiencyPercent()));
        e.setOperatingHoursPerYear(nonNegative(r.operatingHoursPerYear(), "часы работы за год"));
        e.setDescription(trimToNull(r.description()));
        if (r.sortOrder() != null) e.setSortOrder(r.sortOrder());
    }

    private EmissionSourceDto dto(PekEmissionSource e) {
        return new EmissionSourceDto(e.getId(), e.getProgramId(), e.getCode(), e.getName(), e.getSourceType(),
                e.getWorkshopName(), str(e.getHeightM()), str(e.getDiameterM()), e.getCoordinates(),
                e.getGasCleaningEquipment(), str(e.getCleaningEfficiencyPercent()), e.getOperatingHoursPerYear(),
                e.getDescription(), e.getSortOrder(), e.getVersion());
    }

    // ---- discharge outlets ----------------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<DischargeSourceDto> listDischargeSources(Long programId) {
        program(programId);
        return dischargeSources.findByProgramIdOrderBySortOrderAscIdAsc(programId).stream().map(this::dto).toList();
    }

    @Transactional
    public DischargeSourceDto createDischargeSource(Long programId, DischargeSourceRequest r) {
        editable(program(programId));
        PekDischargeSource e = new PekDischargeSource();
        e.setProgramId(programId);
        apply(e, r);
        DischargeSourceDto saved = dto(dischargeSources.saveAndFlush(e));
        revisionService.bump(programId);
        return saved;
    }

    @Transactional
    public DischargeSourceDto updateDischargeSource(Long programId, Long id, DischargeSourceRequest r, Long version) {
        editable(program(programId));
        PekDischargeSource e = dischargeSources.findByIdAndProgramId(id, programId)
                .orElseThrow(() -> new NotFoundException("Выпуск сточных вод не найден: " + id));
        checkVersion(version, e.getVersion());
        apply(e, r);
        e.setUpdatedAt(LocalDateTime.now());
        DischargeSourceDto saved = dto(dischargeSources.saveAndFlush(e));
        revisionService.bump(programId);
        return saved;
    }

    @Transactional
    public void deleteDischargeSource(Long programId, Long id, Long version) {
        editable(program(programId));
        PekDischargeSource e = dischargeSources.findByIdAndProgramId(id, programId)
                .orElseThrow(() -> new NotFoundException("Выпуск сточных вод не найден: " + id));
        checkVersion(version, e.getVersion());
        dischargeSources.delete(e);
        revisionService.bump(programId);
    }

    private void apply(PekDischargeSource e, DischargeSourceRequest r) {
        if (isBlank(r.code())) throw new BadRequestException("Укажите номер выпуска");
        if (isBlank(r.name())) throw new BadRequestException("Укажите наименование выпуска");
        e.setCode(r.code().trim());
        e.setName(r.name().trim());
        e.setReceivingWaterBody(trimToNull(r.receivingWaterBody()));
        e.setDischargeType(trimToNull(r.dischargeType()));
        e.setCoordinates(trimToNull(r.coordinates()));
        e.setPermittedVolume(decimal(r.permittedVolume(), "разрешённый объём сброса"));
        e.setVolumeUnit(trimToNull(r.volumeUnit()));
        e.setTreatmentFacilities(trimToNull(r.treatmentFacilities()));
        e.setDescription(trimToNull(r.description()));
        if (r.sortOrder() != null) e.setSortOrder(r.sortOrder());
    }

    private DischargeSourceDto dto(PekDischargeSource e) {
        return new DischargeSourceDto(e.getId(), e.getProgramId(), e.getCode(), e.getName(),
                e.getReceivingWaterBody(), e.getDischargeType(), e.getCoordinates(),
                str(e.getPermittedVolume()), e.getVolumeUnit(), e.getTreatmentFacilities(),
                e.getDescription(), e.getSortOrder(), e.getVersion());
    }

    // ---- waste catalogue -------------------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<WasteItemDto> listWasteItems(Long programId) {
        program(programId);
        return wasteItems.findByProgramIdOrderBySortOrderAscIdAsc(programId).stream().map(this::dto).toList();
    }

    @Transactional
    public WasteItemDto createWasteItem(Long programId, WasteItemRequest r) {
        editable(program(programId));
        PekWasteItem e = new PekWasteItem();
        e.setProgramId(programId);
        apply(e, r);
        WasteItemDto saved = dto(wasteItems.saveAndFlush(e));
        revisionService.bump(programId);
        return saved;
    }

    @Transactional
    public WasteItemDto updateWasteItem(Long programId, Long id, WasteItemRequest r, Long version) {
        editable(program(programId));
        PekWasteItem e = wasteItems.findByIdAndProgramId(id, programId)
                .orElseThrow(() -> new NotFoundException("Вид отхода не найден: " + id));
        checkVersion(version, e.getVersion());
        apply(e, r);
        e.setUpdatedAt(LocalDateTime.now());
        WasteItemDto saved = dto(wasteItems.saveAndFlush(e));
        revisionService.bump(programId);
        return saved;
    }

    @Transactional
    public void deleteWasteItem(Long programId, Long id, Long version) {
        editable(program(programId));
        PekWasteItem e = wasteItems.findByIdAndProgramId(id, programId)
                .orElseThrow(() -> new NotFoundException("Вид отхода не найден: " + id));
        checkVersion(version, e.getVersion());
        // A waste type that some report already carries figures for must not vanish from under it -
        // the movement row would be left pointing at nothing and the period's numbers would lose
        // their subject.
        if (wasteMovements.existsByWasteItemId(id)) {
            throw new ConflictException(
                    "Вид отхода нельзя удалить: по нему есть данные движения за отчётный период",
                    "PEK_WASTE_ITEM_HAS_MOVEMENTS");
        }
        wasteItems.delete(e);
        revisionService.bump(programId);
    }

    private void apply(PekWasteItem e, WasteItemRequest r) {
        if (isBlank(r.name())) throw new BadRequestException("Укажите вид отхода");
        e.setName(r.name().trim());
        e.setCode(trimToNull(r.code()));
        e.setHazardClass(trimToNull(r.hazardClass()));
        e.setAccumulationLimit(decimal(r.accumulationLimit(), "лимит накопления"));
        e.setLimitUnit(trimToNull(r.limitUnit()));
        e.setAccumulationPeriodDays(nonNegative(r.accumulationPeriodDays(), "срок накопления"));
        e.setStorageSiteName(trimToNull(r.storageSiteName()));
        e.setCoordinates(trimToNull(r.coordinates()));
        e.setDescription(trimToNull(r.description()));
        if (r.sortOrder() != null) e.setSortOrder(r.sortOrder());
    }

    private WasteItemDto dto(PekWasteItem e) {
        return new WasteItemDto(e.getId(), e.getProgramId(), e.getName(), e.getCode(), e.getHazardClass(),
                str(e.getAccumulationLimit()), e.getLimitUnit(), e.getAccumulationPeriodDays(),
                e.getStorageSiteName(), e.getCoordinates(), e.getDescription(), e.getSortOrder(), e.getVersion());
    }

    // ---- waste movements (per report period) ------------------------------------------------------

    @Transactional(readOnly = true)
    public List<WasteMovementDto> listWasteMovements(Long reportId) {
        PekReport report = report(reportId);
        Map<Long, PekWasteItem> catalogue = catalogueFor(report);
        return wasteMovements.findByReportIdOrderByIdAsc(reportId).stream()
                .map(m -> dto(m, catalogue.get(m.getWasteItemId())))
                .toList();
    }

    @Transactional
    public WasteMovementDto upsertWasteMovement(Long reportId, WasteMovementRequest r, Long version) {
        PekReport report = report(reportId);
        reportEditable(report);
        if (r.wasteItemId() == null) throw new BadRequestException("Укажите вид отхода (wasteItemId)");
        PekWasteItem item = wasteItems.findByIdAndProgramId(r.wasteItemId(), report.getProgramId())
                .orElseThrow(() -> new NotFoundException(
                        "Вид отхода не найден в программе этого отчёта: " + r.wasteItemId()));

        PekReportWasteMovement m = wasteMovements
                .findByReportIdAndWasteItemId(reportId, r.wasteItemId())
                .orElse(null);
        if (m == null) {
            m = new PekReportWasteMovement();
            m.setReportId(reportId);
            m.setWasteItemId(r.wasteItemId());
        } else {
            // Updating an existing row is a real edit and needs the usual concurrency check;
            // creating the first one for a waste type does not.
            checkVersion(version, m.getVersion());
            m.setUpdatedAt(LocalDateTime.now());
        }
        m.setOpeningBalance(decimal(r.openingBalance(), "остаток на начало периода"));
        m.setGenerated(decimal(r.generated(), "образование"));
        m.setTransferred(decimal(r.transferred(), "передача"));
        m.setDisposed(decimal(r.disposed(), "удаление"));
        m.setClosingBalance(decimal(r.closingBalance(), "остаток на конец периода"));
        m.setReceiverName(trimToNull(r.receiverName()));
        m.setReceiverBin(bin(r.receiverBin()));
        m.setNote(trimToNull(r.note()));
        WasteMovementDto saved = dto(wasteMovements.saveAndFlush(m), item);
        reportRevisionService.bump(report);
        return saved;
    }

    @Transactional
    public void deleteWasteMovement(Long reportId, Long id, Long version) {
        PekReport report = report(reportId);
        reportEditable(report);
        PekReportWasteMovement m = wasteMovements.findByIdAndReportId(id, reportId)
                .orElseThrow(() -> new NotFoundException("Движение отхода не найдено: " + id));
        checkVersion(version, m.getVersion());
        wasteMovements.delete(m);
        reportRevisionService.bump(report);
    }

    private Map<Long, PekWasteItem> catalogueFor(PekReport report) {
        return wasteItems.findByProgramIdOrderBySortOrderAscIdAsc(report.getProgramId()).stream()
                .collect(Collectors.toMap(PekWasteItem::getId, Function.identity()));
    }

    private WasteMovementDto dto(PekReportWasteMovement m, PekWasteItem item) {
        return new WasteMovementDto(m.getId(), m.getReportId(), m.getWasteItemId(),
                item == null ? null : item.getName(),
                item == null ? null : item.getCode(),
                item == null ? null : item.getHazardClass(),
                item == null ? null : item.getLimitUnit(),
                str(m.getOpeningBalance()), str(m.getGenerated()), str(m.getTransferred()), str(m.getDisposed()),
                str(m.getClosingBalance()), str(m.impliedClosingBalance()), m.reconciles(),
                m.getReceiverName(), m.getReceiverBin(), m.getNote(), m.getVersion());
    }

    // ---- shared helpers ---------------------------------------------------------------------------

    private PekProgram program(Long id) {
        return programRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Программа ПЭК не найдена: " + id));
    }

    private PekReport report(Long id) {
        return reportRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Отчёт ПЭК не найден: " + id));
    }

    private void editable(PekProgram p) {
        if (!p.getStatus().isEditable()) {
            throw new ConflictException("Раздел нельзя изменять в текущем статусе программы",
                    "PEK_PROGRAM_NOT_EDITABLE");
        }
    }

    private void reportEditable(PekReport report) {
        if (!report.getStatus().isEditable()) {
            throw new ConflictException("Данные по отходам нельзя изменять в текущем статусе отчёта",
                    "PEK_REPORT_NOT_EDITABLE");
        }
    }

    private void checkVersion(Long requestVersion, Long actualVersion) {
        if (requestVersion == null) {
            throw new BadRequestException("Требуется версия (заголовок If-Match)", "VERSION_REQUIRED");
        }
        if (!requestVersion.equals(actualVersion)) {
            throw ConflictException.versionConflict("Данные были изменены другим сотрудником",
                    "PEK_VERSION_CONFLICT", actualVersion);
        }
    }

    /** Decimals arrive as strings so a value is never reshaped by JSON float parsing. A malformed
     *  one is rejected by name rather than silently becoming null. */
    private static BigDecimal decimal(String raw, String fieldLabel) {
        if (raw == null || raw.isBlank()) return null;
        try {
            BigDecimal value = new BigDecimal(raw.trim().replace(',', '.'));
            if (value.signum() < 0) {
                throw new BadRequestException("Значение не может быть отрицательным: " + fieldLabel);
            }
            return value;
        } catch (NumberFormatException e) {
            throw new BadRequestException("Некорректное числовое значение (" + fieldLabel + "): " + raw);
        }
    }

    private static BigDecimal percent(String raw) {
        BigDecimal value = decimal(raw, "степень очистки");
        if (value != null && value.compareTo(BigDecimal.valueOf(100)) > 0) {
            throw new BadRequestException("Степень очистки не может превышать 100%");
        }
        return value;
    }

    private static Integer nonNegative(Integer value, String fieldLabel) {
        if (value != null && value < 0) {
            throw new BadRequestException("Значение не может быть отрицательным: " + fieldLabel);
        }
        return value;
    }

    private static String bin(String raw) {
        String trimmed = trimToNull(raw);
        if (trimmed != null && !trimmed.matches("\\d{12}")) {
            throw new BadRequestException("БИН получателя должен состоять из 12 цифр");
        }
        return trimmed;
    }

    private static String str(BigDecimal v) {
        return v == null ? null : v.stripTrailingZeros().toPlainString();
    }

    private static String trimToNull(String s) {
        if (s == null) return null;
        String trimmed = s.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
