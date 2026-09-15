package kz.eco.journal;

import kz.eco.common.exception.BadRequestException;
import kz.eco.common.exception.NotFoundException;
import kz.eco.common.exception.ValidationException;
import kz.eco.journal.dto.LabJournalDtos.JournalEntryRequest;
import kz.eco.journal.dto.LabJournalDtos.JournalEntryResponse;
import kz.eco.journal.dto.LabJournalDtos.JournalTypeResponse;
import kz.eco.journal.dto.LabJournalDtos.PageResponse;
import kz.eco.laboratory.Laboratory;
import kz.eco.laboratory.LaboratoryEmployeeRepository;
import kz.eco.laboratory.LaboratoryRepository;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import kz.eco.user.UserRole;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class LabJournalService {

    private static final int DEFAULT_PAGE_SIZE = 50;
    private static final int MAX_PAGE_SIZE = 500;
    private static final List<String> CHEMICAL_BALANCE_LOCKED_FIELDS =
            List.of("substanceName", "unit", "incomingQuantity", "outgoingQuantity", "balance");
    private static final List<String> NON_NEGATIVE_FIELDS =
            List.of("income", "expense", "componentAmount", "pressure");

    private final LabJournalEntryRepository repository;
    private final LaboratoryEmployeeRepository employeeRepository;
    private final LaboratoryRepository laboratoryRepository;
    private final UserRepository userRepository;
    private final LabJournalRowCounterService rowCounterService;
    private final ObjectMapper objectMapper;

    public LabJournalService(LabJournalEntryRepository repository,
                              LaboratoryEmployeeRepository employeeRepository,
                              LaboratoryRepository laboratoryRepository,
                              UserRepository userRepository,
                              LabJournalRowCounterService rowCounterService,
                              ObjectMapper objectMapper) {
        this.repository = repository;
        this.employeeRepository = employeeRepository;
        this.laboratoryRepository = laboratoryRepository;
        this.userRepository = userRepository;
        this.rowCounterService = rowCounterService;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public List<JournalTypeResponse> listTypes() {
        return JournalTypeRegistry.all().stream()
                .map(d -> new JournalTypeResponse(d.code().name(), d.title(),
                        d.columns().stream().filter(c -> c.key() != null && !c.key().isBlank()
                                && c.title() != null && !c.title().isBlank()).toList()))
                .toList();
    }

    @Transactional(readOnly = true)
    public PageResponse<JournalEntryResponse> search(String journalTypeCode, Integer page, Integer size,
                                                      LocalDate dateFrom, LocalDate dateTo, String search,
                                                      Long requestedLaboratoryId, User currentUser) {
        JournalType type = JournalType.fromCode(journalTypeCode);
        validateDateRange(dateFrom, dateTo);
        Long laboratoryId = resolveLaboratoryScope(requestedLaboratoryId, currentUser, false);
        Pageable pageable = PageRequest.of(
                page == null || page < 0 ? 0 : page,
                size == null || size <= 0 ? DEFAULT_PAGE_SIZE : Math.min(size, MAX_PAGE_SIZE));

        Page<LabJournalEntry> result = repository.search(
                type.name(), laboratoryId, dateFrom, dateTo, normalizeSearch(search), pageable);
        Map<Long, String> laboratoryNames = resolveLaboratoryNames(result.getContent());
        Map<Long, String> userNames = resolveUserNames(result.getContent());
        List<JournalEntryResponse> content = result.getContent().stream()
                .map(e -> toResponse(e, laboratoryNames, userNames)).toList();
        return new PageResponse<>(content, result.getTotalElements(), result.getTotalPages(), result.getNumber(), result.getSize());
    }

    @Transactional(readOnly = true)
    public List<LabJournalEntry> findAllForExport(String journalTypeCode, LocalDate dateFrom, LocalDate dateTo,
                                                   String search, Long requestedLaboratoryId, User currentUser) {
        JournalType type = JournalType.fromCode(journalTypeCode);
        validateDateRange(dateFrom, dateTo);
        Long laboratoryId = resolveLaboratoryScope(requestedLaboratoryId, currentUser, false);
        return repository.searchAll(type.name(), laboratoryId, dateFrom, dateTo, normalizeSearch(search));
    }

    @Transactional
    public JournalEntryResponse create(JournalEntryRequest request, User currentUser) {
        if (request == null) {
            throw new BadRequestException("Укажите данные записи");
        }
        Map<String, Object> requestData = request.effectiveData();
        if (requestData == null || requestData.isEmpty()) {
            throw new BadRequestException("Укажите data");
        }
        JournalType type = JournalType.fromCode(request.journalType());
        JournalDefinition definition = JournalTypeRegistry.get(type);
        validateRequiredFields(definition, requestData);
        Long laboratoryId = resolveLaboratoryScope(request.laboratoryId(), currentUser, true);

        Map<String, Object> data = new LinkedHashMap<>(requestData);
        LocalDate entryDate = requireEntryDate(request.effectiveEntryDate(), definition, data);
        validateFieldRules(data);
        int rowNumber = rowCounterService.allocate(laboratoryId, type.name());
        data.put("rowNumber", rowNumber);
        if (type == JournalType.CHEMICAL_REAGENT_USAGE) {
            applyChemicalBalance(type, laboratoryId, data);
        }

        LabJournalEntry entry = new LabJournalEntry();
        entry.setJournalType(type.name());
        entry.setRowNumber(rowNumber);
        entry.setEntryDate(entryDate);
        entry.setLaboratoryId(laboratoryId);
        entry.setCreatedBy(currentUser.getId());
        entry.setUpdatedBy(currentUser.getId());
        entry.setData(writeJson(data));
        entry.setProtocolId(request.protocolId());
        entry.setProtocolResultId(request.protocolResultId());
        entry.setSampleId(request.sampleId());
        return toResponseSingle(repository.save(entry));
    }

    @Transactional
    public JournalEntryResponse update(Long id, JournalEntryRequest request, User currentUser) {
        if (request == null) {
            throw new BadRequestException("Укажите данные записи");
        }
        Map<String, Object> requestData = request.effectiveData();
        if (requestData == null || requestData.isEmpty()) {
            throw new BadRequestException("Укажите data");
        }
        LabJournalEntry entry = getEditableOrThrow(id, currentUser);
        JournalType type = JournalType.fromCode(entry.getJournalType());
        JournalDefinition definition = JournalTypeRegistry.get(type);
        validateRequiredFields(definition, requestData);

        Map<String, Object> data = new LinkedHashMap<>(requestData);
        // rowNumber is server-assigned at creation time and never changes on edit.
        data.put("rowNumber", entry.getRowNumber());
        if (type == JournalType.CHEMICAL_REAGENT_USAGE) {
            // Balance-affecting fields are audit-locked after creation: editing them here would
            // silently corrupt the running balance of every later entry for this substance.
            // Correcting a mistake must go through a new, separate entry instead.
            Map<String, Object> existing = readData(entry);
            assertChemicalBalanceFieldsUnchanged(existing, data);
            for (String key : CHEMICAL_BALANCE_LOCKED_FIELDS) {
                if (existing.containsKey(key)) {
                    data.put(key, existing.get(key));
                }
            }
        }

        LocalDate entryDate = requireEntryDate(request.effectiveEntryDate(), definition, data);
        validateFieldRules(data);
        // laboratoryId is never changed by a regular edit - see getEditableOrThrow, which already
        // re-validates the caller can touch this entry's existing laboratory.
        entry.setEntryDate(entryDate);
        entry.setUpdatedBy(currentUser.getId());
        entry.setData(writeJson(data));
        return toResponseSingle(repository.save(entry));
    }

    @Transactional
    public void delete(Long id, User currentUser) {
        LabJournalEntry entry = getEditableOrThrow(id, currentUser);
        entry.setDeleted(true);
        entry.setUpdatedBy(currentUser.getId());
        repository.save(entry);
    }

    private LabJournalEntry getEditableOrThrow(Long id, User currentUser) {
        LabJournalEntry entry = repository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new NotFoundException("Запись журнала не найдена: " + id));
        if (!isUnrestrictedRole(currentUser)) {
            Long ownLaboratoryId = resolveOwnLaboratoryId(currentUser);
            if (!ownLaboratoryId.equals(entry.getLaboratoryId())) {
                throw new AccessDeniedException("Запись принадлежит другой лаборатории");
            }
        }
        return entry;
    }

    /**
     * ADMIN and HEAD are oversight roles (same grouping as SecurityExpressions.LAB_PROTOCOL) and
     * may filter/write to any laboratory - but on create, they must explicitly name which one
     * (requireForWrite=true): there is no more "leave it unset for a global entry" shortcut, per
     * the spec. Reads (requireForWrite=false) still allow an unset laboratoryId to mean "all
     * laboratories". A LABORATORY user is always pinned to their own laboratory regardless of
     * what they pass in, so they can never read or write another lab's journal.
     */
    private Long resolveLaboratoryScope(Long requestedLaboratoryId, User currentUser, boolean requireForWrite) {
        if (isUnrestrictedRole(currentUser)) {
            if (requireForWrite && requestedLaboratoryId == null) {
                throw new ValidationException("Укажите laboratoryId",
                        Map.of("laboratoryId", "Укажите laboratoryId"));
            }
            return requestedLaboratoryId;
        }
        return resolveOwnLaboratoryId(currentUser);
    }

    private boolean isUnrestrictedRole(User currentUser) {
        return currentUser.getRole() == UserRole.ADMIN || currentUser.getRole() == UserRole.HEAD;
    }

    private Long resolveOwnLaboratoryId(User currentUser) {
        return employeeRepository.findFirstByUserIdAndActiveTrue(currentUser.getId())
                .map(kz.eco.laboratory.LaboratoryEmployee::getLaboratoryId)
                .orElseThrow(() -> new BadRequestException(
                        "Пользователь не привязан ни к одной лаборатории"));
    }

    private void validateDateRange(LocalDate dateFrom, LocalDate dateTo) {
        if (dateFrom != null && dateTo != null && dateFrom.isAfter(dateTo)) {
            throw new ValidationException("dateFrom не может быть позже dateTo",
                    Map.of("dateFrom", "dateFrom не может быть позже dateTo"));
        }
    }

    private LocalDate requireEntryDate(String requestEntryDate, JournalDefinition definition, Map<String, Object> data) {
        LocalDate entryDate = resolveEntryDate(requestEntryDate, definition, data);
        if (entryDate == null) {
            throw new ValidationException("Дата не может быть пустой",
                    Map.of("entryDate", "Укажите entryDate"));
        }
        if (entryDate.isAfter(LocalDate.now())) {
            throw new ValidationException("Дата не может быть будущей",
                    Map.of("entryDate", "Дата не может быть будущей"));
        }
        return entryDate;
    }

    private LocalDate resolveEntryDate(String requestEntryDate, JournalDefinition definition, Map<String, Object> data) {
        if (requestEntryDate != null && !requestEntryDate.isBlank()) {
            return parseDateSafe(requestEntryDate);
        }
        Object fromData = data.get(definition.primaryDateKey());
        return fromData != null ? parseDateSafe(String.valueOf(fromData)) : null;
    }

    private LocalDate parseDateSafe(String value) {
        try {
            return LocalDate.parse(value.trim());
        } catch (Exception e) {
            throw new BadRequestException("Некорректная дата: " + value);
        }
    }

    /**
     * Generic field-name-keyed rules from the spec, applied to whichever of these keys happen to
     * be present in this journal type's data (a no-op for keys the schema doesn't have).
     */
    private void validateFieldRules(Map<String, Object> data) {
        Map<String, String> errors = new LinkedHashMap<>();
        for (String field : NON_NEGATIVE_FIELDS) {
            BigDecimal value = tryBigDecimal(data.get(field));
            if (value != null && value.signum() < 0) {
                errors.put(field, field + " не может быть отрицательным");
            }
        }
        BigDecimal humidity = tryBigDecimal(data.get("humidity"));
        if (humidity != null && (humidity.compareTo(BigDecimal.ZERO) < 0 || humidity.compareTo(BigDecimal.valueOf(100)) > 0)) {
            errors.put("humidity", "humidity должна быть от 0 до 100");
        }
        LocalDate preparedDate = tryDate(data.get("preparedDate"));
        LocalDate expiryDate = tryDate(data.get("expiryDate"));
        if (preparedDate != null && expiryDate != null && expiryDate.isBefore(preparedDate)) {
            errors.put("expiryDate", "expiryDate не может быть раньше preparedDate");
        }
        if (preparedDate != null && preparedDate.isAfter(LocalDate.now())) {
            errors.put("preparedDate", "preparedDate не может быть будущей");
        }
        LocalDate samplingDate = tryDate(data.get("samplingDate"));
        if (samplingDate != null && samplingDate.isAfter(LocalDate.now())) {
            errors.put("samplingDate", "samplingDate не может быть будущей");
        }
        // Reject non-finite numeric fields anywhere in the payload (NaN/Infinity can only arrive
        // as a JSON number via a custom client, not standard JSON, but guard anyway).
        for (Map.Entry<String, Object> entry : data.entrySet()) {
            if (entry.getValue() instanceof Double d && !Double.isFinite(d)) {
                errors.put(entry.getKey(), "Некорректное числовое значение");
            }
        }
        if (!errors.isEmpty()) {
            throw new ValidationException("Некорректные данные записи журнала", errors);
        }
    }

    private LocalDate tryDate(Object value) {
        if (value == null) {
            return null;
        }
        try {
            return LocalDate.parse(String.valueOf(value).trim());
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * balance = previousBalance + incomingQuantity - outgoingQuantity, where previousBalance is
     * the balance of the most recent entry for the SAME journal + laboratory + substance + unit
     * (not just journal + laboratory - otherwise unrelated substances share one running total).
     */
    private void applyChemicalBalance(JournalType type, Long laboratoryId, Map<String, Object> data) {
        String substanceName = stringValue(data.get("substanceName"));
        String unit = stringValue(data.get("unit"));
        if (substanceName == null || substanceName.isBlank()) {
            throw new BadRequestException("Укажите substanceName");
        }
        if (unit == null || unit.isBlank()) {
            throw new BadRequestException("Укажите unit");
        }
        if (data.get("incomingQuantity") == null && data.get("outgoingQuantity") == null) {
            throw new BadRequestException("Укажите incomingQuantity или outgoingQuantity");
        }
        BigDecimal incoming = toBigDecimal(data.get("incomingQuantity"));
        BigDecimal outgoing = toBigDecimal(data.get("outgoingQuantity"));
        if (incoming.signum() < 0 || outgoing.signum() < 0) {
            throw new BadRequestException("incomingQuantity и outgoingQuantity не могут быть отрицательными");
        }

        BigDecimal previousBalance = findPreviousChemicalBalance(type, laboratoryId, substanceName, unit);
        // Compare the expense against balance-after-today's-income: a single entry is allowed to
        // record reagent arriving and being used in the same line (e.g. income=100, expense=20).
        BigDecimal availableBalance = previousBalance.add(incoming);
        if (outgoing.compareTo(availableBalance) > 0) {
            throw new BadRequestException("Недостаточно остатка химического вещества");
        }
        data.put("balance", availableBalance.subtract(outgoing));
    }

    private BigDecimal findPreviousChemicalBalance(JournalType type, Long laboratoryId, String substanceName, String unit) {
        return repository.findAllForBalanceScope(type.name(), laboratoryId).stream()
                .map(this::readData)
                .filter(entryData -> substanceName.equalsIgnoreCase(stringValue(entryData.get("substanceName")))
                        && unit.equalsIgnoreCase(stringValue(entryData.get("unit"))))
                .findFirst()
                .map(entryData -> toBigDecimal(entryData.get("balance")))
                .orElse(BigDecimal.ZERO);
    }

    private String stringValue(Object value) {
        return value != null ? String.valueOf(value).trim() : null;
    }

    private void validateRequiredFields(JournalDefinition definition, Map<String, Object> data) {
        for (String key : definition.requiredKeys()) {
            Object value = data.get(key);
            if (value == null || String.valueOf(value).isBlank()) {
                throw new BadRequestException("Укажите " + key);
            }
        }
    }

    private void assertChemicalBalanceFieldsUnchanged(Map<String, Object> existing, Map<String, Object> requested) {
        for (String key : CHEMICAL_BALANCE_LOCKED_FIELDS) {
            if (!valuesEqual(existing.get(key), requested.get(key))) {
                throw new BadRequestException(
                        "Нельзя изменить приход/расход химического вещества после создания записи. "
                                + "Создайте корректирующую запись.");
            }
        }
    }

    private boolean valuesEqual(Object existing, Object requested) {
        if (requested == null) {
            // The field simply wasn't resubmitted - not a change.
            return true;
        }
        if (existing == null) {
            return String.valueOf(requested).isBlank();
        }
        BigDecimal existingNumber = tryBigDecimal(existing);
        BigDecimal requestedNumber = tryBigDecimal(requested);
        if (existingNumber != null && requestedNumber != null) {
            return existingNumber.compareTo(requestedNumber) == 0;
        }
        return String.valueOf(existing).trim().equals(String.valueOf(requested).trim());
    }

    private BigDecimal tryBigDecimal(Object value) {
        if (value == null) {
            return null;
        }
        try {
            return new BigDecimal(String.valueOf(value).trim().replace(',', '.'));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private BigDecimal toBigDecimal(Object value) {
        if (value == null) {
            return BigDecimal.ZERO;
        }
        if (value instanceof Number n) {
            return BigDecimal.valueOf(n.doubleValue());
        }
        try {
            return new BigDecimal(String.valueOf(value).trim().replace(',', '.'));
        } catch (NumberFormatException e) {
            return BigDecimal.ZERO;
        }
    }

    private String normalizeSearch(String search) {
        return search == null || search.isBlank() ? null : search.trim();
    }

    String writeJson(Map<String, Object> data) {
        return objectMapper.writeValueAsString(data);
    }

    Map<String, Object> readData(LabJournalEntry entry) {
        if (entry.getData() == null || entry.getData().isBlank()) {
            return new LinkedHashMap<>();
        }
        return objectMapper.readValue(entry.getData(), new TypeReference<LinkedHashMap<String, Object>>() {
        });
    }

    private Map<Long, String> resolveLaboratoryNames(List<LabJournalEntry> entries) {
        Set<Long> ids = entries.stream().map(LabJournalEntry::getLaboratoryId)
                .filter(java.util.Objects::nonNull).collect(Collectors.toSet());
        if (ids.isEmpty()) {
            return Map.of();
        }
        return laboratoryRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(Laboratory::getId, Laboratory::getName, (a, b) -> a));
    }

    private Map<Long, String> resolveUserNames(List<LabJournalEntry> entries) {
        Set<Long> ids = entries.stream().map(LabJournalEntry::getCreatedBy)
                .filter(java.util.Objects::nonNull).collect(Collectors.toSet());
        if (ids.isEmpty()) {
            return Map.of();
        }
        return userRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(User::getId, User::getName, (a, b) -> a));
    }

    private JournalEntryResponse toResponseSingle(LabJournalEntry entry) {
        Map<Long, String> labNames = new HashMap<>();
        if (entry.getLaboratoryId() != null) {
            laboratoryRepository.findById(entry.getLaboratoryId())
                    .ifPresent(lab -> labNames.put(lab.getId(), lab.getName()));
        }
        Map<Long, String> userNames = new HashMap<>();
        if (entry.getCreatedBy() != null) {
            userRepository.findById(entry.getCreatedBy())
                    .ifPresent(user -> userNames.put(user.getId(), user.getName()));
        }
        return toResponse(entry, labNames, userNames);
    }

    private JournalEntryResponse toResponse(LabJournalEntry entry, Map<Long, String> laboratoryNames, Map<Long, String> userNames) {
        return new JournalEntryResponse(
                entry.getId(),
                entry.getJournalType(),
                entry.getRowNumber(),
                entry.getEntryDate() != null ? entry.getEntryDate().toString() : null,
                entry.getLaboratoryId(),
                entry.getLaboratoryId() != null ? laboratoryNames.get(entry.getLaboratoryId()) : null,
                readData(entry),
                entry.getCreatedBy(),
                entry.getCreatedBy() != null ? userNames.get(entry.getCreatedBy()) : null,
                entry.getCreatedAt() != null ? entry.getCreatedAt().toString() : null,
                entry.getUpdatedAt() != null ? entry.getUpdatedAt().toString() : null,
                entry.getProtocolId(),
                entry.getProtocolResultId(),
                entry.getSampleId());
    }
}
