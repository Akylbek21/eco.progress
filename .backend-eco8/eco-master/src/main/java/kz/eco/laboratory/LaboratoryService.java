package kz.eco.laboratory;

import kz.eco.common.exception.BadRequestException;
import kz.eco.common.exception.ConflictException;
import kz.eco.common.exception.NotFoundException;
import kz.eco.common.exception.ValidationException;
import kz.eco.laboratory.dto.LaboratoryDtos;
import kz.eco.protocol.ProtocolApiMapper;
import kz.eco.storage.FileStorageService;
import kz.eco.storage.StoredFileContent;
import kz.eco.storage.StoredFileMetadata;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import kz.eco.user.UserRole;
import kz.eco.user.UserStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;

@Service
public class LaboratoryService {

    private static final Set<String> ALLOWED_LOGO_CONTENT_TYPES = Set.of(
            "image/png", "image/jpeg", "image/jpg");
    private static final Set<String> ALLOWED_LOGO_EXTENSIONS = Set.of(
            "png", "jpg", "jpeg");
    private static final long MAX_LOGO_SIZE_BYTES = 2L * 1024 * 1024;
    private static final Pattern BIN_PATTERN = Pattern.compile("\\d{12}");
    private static final Set<String> ALLOWED_EMPLOYEE_ROLES = Set.of("LABORATORY", "HEAD", "DIRECTOR");
    private static final List<UserRole> ELIGIBLE_USER_ROLES =
            List.of(UserRole.ADMIN, UserRole.DIRECTOR, UserRole.HEAD, UserRole.LABORATORY);

    private final LaboratoryRepository laboratoryRepository;
    private final LaboratoryEmployeeRepository employeeRepository;
    private final FileStorageService fileStorageService;
    private final UserRepository userRepository;

    public LaboratoryService(LaboratoryRepository laboratoryRepository,
                             LaboratoryEmployeeRepository employeeRepository,
                             FileStorageService fileStorageService,
                             UserRepository userRepository) {
        this.laboratoryRepository = laboratoryRepository;
        this.employeeRepository = employeeRepository;
        this.fileStorageService = fileStorageService;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public List<LaboratoryDtos.LaboratoryResponse> list(boolean includeInactive) {
        List<Laboratory> labs = laboratoryRepository.findAllOrderedByDefaultThenActiveThenName();
        if (!includeInactive) {
            labs = labs.stream().filter(Laboratory::isActive).toList();
        }
        return labs.stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<LaboratoryDtos.EligibleEmployeeResponse> eligibleEmployees() {
        return userRepository.findByRoleInAndStatusNot(ELIGIBLE_USER_ROLES, UserStatus.blocked).stream()
                .filter(u -> u.getStatus() != UserStatus.deleted)
                .map(u -> new LaboratoryDtos.EligibleEmployeeResponse(
                        u.getId(), u.getId(), u.getName(), u.getPosition(), u.getEmail(),
                        u.getRole().name(), u.getStatus() == UserStatus.active))
                .toList();
    }

    @Transactional(readOnly = true)
    public LaboratoryDtos.LaboratoryResponse get(Long id) {
        return toResponse(getActiveOrThrow(id));
    }

    @Transactional(readOnly = true)
    public List<LaboratoryDtos.LaboratoryEmployeeResponse> listEmployees(Long laboratoryId, boolean includeInactive) {
        getActiveOrThrow(laboratoryId);
        List<LaboratoryEmployee> employees = includeInactive
                ? employeeRepository.findByLaboratoryIdOrderByFullNameAsc(laboratoryId)
                : employeeRepository.findByLaboratoryIdAndActiveTrueOrderByFullNameAsc(laboratoryId);
        return employees.stream().map(this::toEmployeeResponse).toList();
    }

    @Transactional
    public LaboratoryDtos.LaboratoryResponse create(LaboratoryDtos.CreateLaboratoryRequest request) {
        Map<String, String> errors = new LinkedHashMap<>();
        if (request.name() == null || request.name().isBlank()) {
            errors.put("name", "Укажите название лаборатории");
        }
        if (request.address() == null || request.address().isBlank()) {
            errors.put("address", "Укажите адрес лаборатории");
        }
        validateBin(request.bin(), null, errors);
        validateContactFields(request.email(), request.phone(), errors);
        validateAccreditation(request.accreditationNumber(), request.accreditationIssuedAt(),
                request.accreditationValidUntil(), errors);
        boolean effectiveActive = request.active() == null || request.active();
        if (Boolean.TRUE.equals(request.isDefault()) && !effectiveActive) {
            throw new ValidationException("Лаборатория по умолчанию должна быть активной",
                    "LABORATORY_DEFAULT_MUST_BE_ACTIVE", Map.of("isDefault", "Лаборатория по умолчанию должна быть активной"));
        }
        ValidationHelper.throwIfErrors(errors);

        Laboratory lab = new Laboratory();
        applyCreate(lab, request);
        applyDefaultFlag(lab, request.isDefault());
        return toResponse(laboratoryRepository.save(lab));
    }

    @Transactional
    public LaboratoryDtos.LaboratoryResponse update(Long id, LaboratoryDtos.UpdateLaboratoryRequest request, User currentUser) {
        Laboratory lab = laboratoryRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Лаборатория не найдена: " + id, "LABORATORY_NOT_FOUND"));
        boolean isAdmin = currentUser != null && currentUser.getRole() == UserRole.ADMIN;
        if (!isAdmin) {
            assertHeadCanEditFields(lab, request);
        }

        Map<String, String> errors = new LinkedHashMap<>();
        validateBin(request.bin(), id, errors);
        validateContactFields(request.email(), request.phone(), errors);
        validateAccreditation(
                request.accreditationNumber() != null ? request.accreditationNumber() : lab.getAccreditationNumber(),
                request.accreditationIssuedAt() != null ? request.accreditationIssuedAt() : ProtocolApiMapper.formatDate(lab.getAccreditationIssuedAt()),
                request.accreditationValidUntil() != null ? request.accreditationValidUntil() : ProtocolApiMapper.formatDate(lab.getAccreditationValidUntil()),
                errors);

        boolean effectiveActive = request.active() != null ? request.active() : lab.isActive();
        boolean effectiveDefault = request.isDefault() != null ? request.isDefault() : lab.isDefault();
        if (effectiveDefault && !effectiveActive) {
            errors.put("isDefault", "Лаборатория по умолчанию должна быть активной");
        }
        if (request.active() != null && !request.active() && lab.isActive()) {
            assertCanDeactivate(lab, effectiveDefault, errors);
        }
        ValidationHelper.throwIfErrors(errors);

        applyUpdate(lab, request);
        applyDefaultFlag(lab, request.isDefault());
        return toResponse(laboratoryRepository.save(lab));
    }

    /**
     * HEAD may PATCH the full DTO, but must not actually *change* the ADMIN-only fields (bin,
     * legalName, accreditation*, director assignment, isDefault, active). Sending back the same
     * value the record already has is fine (that's the common "full DTO round-trip" case) - only
     * an actual change to one of these is rejected.
     */
    private void assertHeadCanEditFields(Laboratory lab, LaboratoryDtos.UpdateLaboratoryRequest request) {
        if (changed(request.bin(), lab.getBin())) denyProtectedField("bin");
        if (changed(request.legalName(), lab.getLegalName())) denyProtectedField("legalName");
        if (changed(request.accreditationNumber(), lab.getAccreditationNumber())) denyProtectedField("accreditationNumber");
        if (changed(request.accreditationIssuedAt(), ProtocolApiMapper.formatDate(lab.getAccreditationIssuedAt()))) {
            denyProtectedField("accreditationIssuedAt");
        }
        if (changed(request.accreditationValidUntil(), ProtocolApiMapper.formatDate(lab.getAccreditationValidUntil()))) {
            denyProtectedField("accreditationValidUntil");
        }
        if (request.directorId() != null && !request.directorId().equals(lab.getDirectorId())) {
            denyProtectedField("directorId");
        }
        if (changed(request.directorName(), lab.getDirectorName()) && request.directorId() == null) {
            denyProtectedField("directorName");
        }
        if (request.isDefault() != null && request.isDefault() != lab.isDefault()) {
            denyProtectedField("isDefault");
        }
        if (request.active() != null && request.active() != lab.isActive()) {
            denyProtectedField("active");
        }
    }

    private void denyProtectedField(String field) {
        throw new AccessDeniedException("Изменение поля \"" + field + "\" доступно только администратору");
    }

    private static boolean changed(String requested, String current) {
        if (requested == null) {
            return false;
        }
        String requestedTrimmed = requested.isBlank() ? null : requested.trim();
        return !Objects.equals(requestedTrimmed, current);
    }

    private void assertCanDeactivate(Laboratory lab, boolean effectiveDefault, Map<String, String> errors) {
        long activeCount = laboratoryRepository.countByActiveTrue();
        if (activeCount <= 1) {
            errors.put("active", "Нельзя деактивировать последнюю активную лабораторию");
            return;
        }
        if (lab.isDefault() && effectiveDefault) {
            errors.put("active", "Нельзя деактивировать лабораторию по умолчанию без назначения другой");
        }
    }

    private void validateBin(String bin, Long excludeId, Map<String, String> errors) {
        if (bin == null || bin.isBlank()) {
            return;
        }
        String trimmed = bin.trim();
        if (!BIN_PATTERN.matcher(trimmed).matches()) {
            errors.put("bin", "БИН должен содержать 12 цифр");
            return;
        }
        boolean duplicate = excludeId != null
                ? laboratoryRepository.existsByBinAndIdNot(trimmed, excludeId)
                : laboratoryRepository.existsByBin(trimmed);
        if (duplicate) {
            throw new ConflictException("Лаборатория с таким БИН уже существует", "LABORATORY_BIN_ALREADY_EXISTS");
        }
    }

    private void validateContactFields(String email, String phone, Map<String, String> errors) {
        if (email != null && !email.isBlank() && !email.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) {
            errors.put("email", "Некорректный email");
        }
        if (phone != null && !phone.isBlank() && digitCount(phone) < 10) {
            errors.put("phone", "Телефон должен содержать минимум 10 цифр");
        }
    }

    private void validateAccreditation(String number, String issuedAt, String validUntil, Map<String, String> errors) {
        boolean anyFilled = isFilled(number) || isFilled(issuedAt) || isFilled(validUntil);
        if (!anyFilled) {
            return;
        }
        if (!isFilled(number) || !isFilled(issuedAt) || !isFilled(validUntil)) {
            errors.put("accreditationNumber", "Заполните номер, дату выдачи и срок действия аттестата целиком");
            return;
        }
        try {
            LocalDate issued = ProtocolApiMapper.parseDate(issuedAt);
            LocalDate valid = ProtocolApiMapper.parseDate(validUntil);
            if (valid.isBefore(issued)) {
                errors.put("accreditationValidUntil", "Срок действия аттестата не может быть раньше даты выдачи");
            }
        } catch (RuntimeException e) {
            errors.put("accreditationIssuedAt", "Некорректный формат даты аттестата");
        }
    }

    private static boolean isFilled(String value) {
        return value != null && !value.isBlank();
    }

    private static int digitCount(String value) {
        int count = 0;
        for (char c : value.toCharArray()) {
            if (Character.isDigit(c)) count++;
        }
        return count;
    }

    /**
     * isDefault must be handled for both true and false - previously only `true` did anything,
     * so `{"isDefault": false}` silently left the laboratory as the default one. `null` means
     * "the field was not sent at all", so it still leaves the current flag untouched.
     */
    private void applyDefaultFlag(Laboratory lab, Boolean requestedDefault) {
        if (requestedDefault == null) {
            return;
        }
        if (requestedDefault) {
            clearDefaultFlag();
            lab.setDefault(true);
        } else {
            lab.setDefault(false);
        }
    }

    @Transactional
    public LaboratoryDtos.LaboratoryResponse uploadLogo(Long id, MultipartFile file, Long userId) {
        Laboratory lab = laboratoryRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Лаборатория не найдена", "LABORATORY_NOT_FOUND"));
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Файл логотипа не передан");
        }
        if (!isAllowedLogoFile(file)) {
            throw new kz.eco.common.exception.ValidationException(
                    "Недопустимый формат логотипа", "LABORATORY_LOGO_UNSUPPORTED_TYPE", Map.of());
        }
        if (file.getSize() > MAX_LOGO_SIZE_BYTES) {
            throw new kz.eco.common.exception.ValidationException(
                    "Логотип превышает максимальный размер 2 МБ", "LABORATORY_LOGO_TOO_LARGE", Map.of());
        }
        try {
            StoredFileMetadata stored = fileStorageService.store(
                    file, "laboratory-" + id, userId != null ? String.valueOf(userId) : null);
            lab.setLogoFileId(stored.fileId());
            lab.setLogoUrl("/api/settings/laboratories/" + id + "/logo");
        } catch (IOException e) {
            throw new BadRequestException("Не удалось сохранить логотип: " + e.getMessage());
        }
        return toResponse(laboratoryRepository.save(lab));
    }

    @Transactional(readOnly = true)
    public StoredFileContent loadLogo(Long id) throws IOException {
        Laboratory lab = getActiveOrThrow(id);
        if (lab.getLogoFileId() == null || lab.getLogoFileId().isBlank()) {
            throw new NotFoundException("Логотип лаборатории не загружен");
        }
        return fileStorageService.load(lab.getLogoFileId());
    }

    @Transactional
    public LaboratoryDtos.LaboratoryResponse removeLogo(Long id) {
        Laboratory lab = laboratoryRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Лаборатория не найдена", "LABORATORY_NOT_FOUND"));
        if (lab.getLogoFileId() != null && !lab.getLogoFileId().isBlank()) {
            fileStorageService.delete(lab.getLogoFileId());
        }
        lab.setLogoFileId(null);
        lab.setLogoUrl(null);
        return toResponse(laboratoryRepository.save(lab));
    }

    @Transactional(readOnly = true)
    public LaboratoryDtos.LaboratoryResponse getDefault() {
        return toResponse(resolveDefaultLaboratoryOrThrow());
    }

    /** MIME/extension check plus an actual magic-byte sniff, so a .png-renamed-to-.jpg (or any
     *  file whose declared type doesn't match its real bytes) is rejected rather than trusted. */
    private boolean isAllowedLogoFile(MultipartFile file) {
        String contentType = file.getContentType();
        boolean declaredOk = contentType != null && ALLOWED_LOGO_CONTENT_TYPES.contains(contentType.toLowerCase());
        if (!declaredOk) {
            String filename = file.getOriginalFilename();
            if (filename != null && filename.contains(".")) {
                String extension = filename.substring(filename.lastIndexOf('.') + 1).toLowerCase();
                declaredOk = ALLOWED_LOGO_EXTENSIONS.contains(extension);
            }
        }
        if (!declaredOk) {
            return false;
        }
        return matchesImageSignature(file);
    }

    private boolean matchesImageSignature(MultipartFile file) {
        try {
            byte[] header = new byte[8];
            int read;
            try (var in = file.getInputStream()) {
                read = in.readNBytes(header, 0, header.length);
            }
            if (read < 3) {
                return false;
            }
            // PNG: 89 50 4E 47 ...; JPEG: FF D8 FF ...
            boolean isPng = read >= 4 && (header[0] & 0xFF) == 0x89 && header[1] == 0x50
                    && header[2] == 0x4E && header[3] == 0x47;
            boolean isJpeg = (header[0] & 0xFF) == 0xFF && (header[1] & 0xFF) == 0xD8 && (header[2] & 0xFF) == 0xFF;
            return isPng || isJpeg;
        } catch (IOException e) {
            return false;
        }
    }

    @Transactional(readOnly = true)
    public Laboratory getActiveByIdOrThrow(Long id) {
        return getActiveOrThrow(id);
    }

    @Transactional(readOnly = true)
    public Laboratory resolveDefaultLaboratoryOrThrow() {
        List<Laboratory> active = laboratoryRepository.findByActiveTrueOrderByNameAsc();
        if (active.isEmpty()) {
            throw new BadRequestException("Лаборатория не настроена. Заполните настройки лаборатории.");
        }
        Optional<Laboratory> defaultLab = active.stream().filter(Laboratory::isDefault).findFirst();
        if (defaultLab.isPresent()) {
            return defaultLab.get();
        }
        if (active.size() == 1) {
            return active.getFirst();
        }
        throw new BadRequestException("Назначьте лабораторию по умолчанию в настройках.");
    }

    @Transactional(readOnly = true)
    public Optional<LaboratoryEmployee> findActiveEmployee(Long laboratoryId, Long employeeId) {
        if (laboratoryId == null || employeeId == null) {
            return Optional.empty();
        }
        return employeeRepository.findByIdAndLaboratoryId(employeeId, laboratoryId)
                .filter(LaboratoryEmployee::isActive);
    }

    /** Legacy-compatibility lookup: callers that still send a users.id instead of a
     *  laboratory_employees.id in executorId land here as a fallback. */
    @Transactional(readOnly = true)
    public Optional<LaboratoryEmployee> findActiveEmployeeByUserId(Long laboratoryId, Long userId) {
        if (laboratoryId == null || userId == null) {
            return Optional.empty();
        }
        return employeeRepository.findByLaboratoryIdAndUserIdAndActiveTrue(laboratoryId, userId);
    }

    @Transactional(readOnly = true)
    public Optional<LaboratoryEmployee> findFirstActiveEmployee(Long laboratoryId) {
        List<LaboratoryEmployee> employees = employeeRepository
                .findByLaboratoryIdAndActiveTrueOrderByFullNameAsc(laboratoryId);
        return employees.isEmpty() ? Optional.empty() : Optional.of(employees.getFirst());
    }

    /** Looks up an active employee by id regardless of laboratory - used only to distinguish
     *  "this employee id doesn't exist at all" (EXECUTOR_NOT_FOUND) from "it exists, just not in
     *  the requested laboratory" (EXECUTOR_LABORATORY_MISMATCH) when reporting a lookup failure. */
    @Transactional(readOnly = true)
    public Optional<LaboratoryEmployee> findAnyActiveEmployeeById(Long employeeId) {
        if (employeeId == null) {
            return Optional.empty();
        }
        return employeeRepository.findById(employeeId).filter(LaboratoryEmployee::isActive);
    }

    @Transactional
    public LaboratoryDtos.LaboratoryEmployeeResponse createEmployee(Long laboratoryId,
                                                                    LaboratoryDtos.CreateEmployeeRequest request,
                                                                    User currentUser) {
        getActiveOrThrow(laboratoryId);
        String role = validateEmployeeRole(request.role(), currentUser);
        User user = null;
        if (request.userId() != null) {
            user = userRepository.findById(request.userId())
                    .orElseThrow(() -> new NotFoundException("Пользователь не найден: " + request.userId()));
            if (employeeRepository.findByLaboratoryIdAndUserIdAndActiveTrue(laboratoryId, request.userId()).isPresent()) {
                throw new ConflictException("Пользователь уже добавлен в эту лабораторию", "LABORATORY_EMPLOYEE_ALREADY_EXISTS");
            }
        }
        String fullName = firstNonBlank(request.fullName(), user != null ? user.getName() : null);
        if (fullName == null || fullName.isBlank()) {
            throw new BadRequestException("Укажите ФИО сотрудника");
        }
        LaboratoryEmployee employee = new LaboratoryEmployee();
        employee.setLaboratoryId(laboratoryId);
        employee.setUserId(request.userId());
        employee.setFullName(fullName.trim());
        employee.setPosition(trim(request.position()));
        employee.setEmail(firstNonBlank(trim(request.email()), user != null ? user.getEmail() : null));
        employee.setRole(role);
        employee.setActive(request.active() == null || request.active());
        return toEmployeeResponse(employeeRepository.save(employee));
    }

    /** LABORATORY/HEAD/DIRECTOR are the only assignable roles; DIRECTOR may only be granted by
     *  ADMIN, and a HEAD caller may only assign LABORATORY or HEAD. Returns the canonical role, or
     *  the existing employee role if the request didn't send one (update path). */
    private String validateEmployeeRole(String requestedRole, User currentUser) {
        if (requestedRole == null || requestedRole.isBlank()) {
            return "LABORATORY";
        }
        String role = requestedRole.trim().toUpperCase();
        if (!ALLOWED_EMPLOYEE_ROLES.contains(role)) {
            throw new ValidationException("Недопустимая роль сотрудника: " + requestedRole,
                    Map.of("role", "Роль должна быть LABORATORY, HEAD или DIRECTOR"));
        }
        boolean isAdmin = currentUser != null && currentUser.getRole() == UserRole.ADMIN;
        if ("DIRECTOR".equals(role) && !isAdmin) {
            throw new AccessDeniedException("Роль DIRECTOR может назначать только администратор");
        }
        return role;
    }

    private static String firstNonBlank(String a, String b) {
        if (a != null && !a.isBlank()) {
            return a;
        }
        return b;
    }

    @Transactional
    public LaboratoryDtos.LaboratoryEmployeeResponse updateEmployee(Long laboratoryId,
                                                                    Long employeeId,
                                                                    LaboratoryDtos.UpdateEmployeeRequest request,
                                                                    User currentUser) {
        getActiveOrThrow(laboratoryId);
        LaboratoryEmployee employee = employeeRepository.findByIdAndLaboratoryId(employeeId, laboratoryId)
                .orElseThrow(() -> new NotFoundException("Сотрудник не найден", "LABORATORY_EMPLOYEE_NOT_FOUND"));
        if (request.userId() != null) employee.setUserId(request.userId());
        if (request.fullName() != null && !request.fullName().isBlank()) {
            employee.setFullName(request.fullName().trim());
        }
        if (request.position() != null) employee.setPosition(trim(request.position()));
        if (request.email() != null) employee.setEmail(trim(request.email()));
        if (request.role() != null) {
            employee.setRole(validateEmployeeRole(request.role(), currentUser));
        }
        if (request.active() != null) employee.setActive(request.active());
        return toEmployeeResponse(employeeRepository.save(employee));
    }

    /** Soft-delete only: historical protocols keep showing this employee through their own
     * laboratory snapshot, so nothing else needs to change when they're deactivated. */
    @Transactional
    public LaboratoryDtos.LaboratoryEmployeeResponse archiveEmployee(Long laboratoryId, Long employeeId) {
        Laboratory lab = getActiveOrThrow(laboratoryId);
        LaboratoryEmployee employee = employeeRepository.findByIdAndLaboratoryId(employeeId, laboratoryId)
                .orElseThrow(() -> new NotFoundException("Сотрудник не найден", "LABORATORY_EMPLOYEE_NOT_FOUND"));
        if (employeeId.equals(lab.getDirectorId())) {
            throw new ConflictException(
                    "Сотрудник назначен директором лаборатории. Сначала выберите другого директора",
                    "LABORATORY_EMPLOYEE_IS_ASSIGNEE");
        }
        if (employeeId.equals(lab.getLaboratoryHeadId())) {
            throw new ConflictException(
                    "Сотрудник назначен заведующим лабораторией. Сначала выберите другого заведующего",
                    "LABORATORY_EMPLOYEE_IS_ASSIGNEE");
        }
        employee.setActive(false);
        return toEmployeeResponse(employeeRepository.save(employee));
    }

    @Transactional(readOnly = true)
    public Laboratory getActiveOrThrow(Long id) {
        Laboratory lab = laboratoryRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Лаборатория не найдена", "LABORATORY_NOT_FOUND"));
        if (!lab.isActive()) {
            throw new NotFoundException("Лаборатория не найдена", "LABORATORY_NOT_FOUND");
        }
        return lab;
    }

    private void clearDefaultFlag() {
        laboratoryRepository.findFirstByIsDefaultTrueAndActiveTrue().ifPresent(existing -> {
            existing.setDefault(false);
            laboratoryRepository.save(existing);
        });
    }

    private void applyCreate(Laboratory lab, LaboratoryDtos.CreateLaboratoryRequest request) {
        lab.setName(request.name().trim());
        lab.setLegalName(trim(request.legalName()));
        lab.setBin(trim(request.bin()));
        lab.setAddress(trim(request.address()));
        lab.setPhone(trim(request.phone()));
        lab.setEmail(trim(request.email()));
        lab.setAccreditationNumber(trim(request.accreditationNumber()));
        lab.setAccreditationIssuedAt(ProtocolApiMapper.parseDate(request.accreditationIssuedAt()));
        lab.setAccreditationValidUntil(ProtocolApiMapper.parseDate(request.accreditationValidUntil()));
        lab.setDirectorId(request.directorId());
        lab.setDirectorName(trim(request.directorName()));
        lab.setLaboratoryHeadId(request.laboratoryHeadId());
        lab.setLaboratoryHeadName(trim(request.laboratoryHeadName()));
        lab.setLogoUrl(trim(request.logoUrl()));
        lab.setStandardNote(trim(request.standardNote()));
        lab.setActive(request.active() == null || request.active());
    }

    private void applyUpdate(Laboratory lab, LaboratoryDtos.UpdateLaboratoryRequest request) {
        if (request.name() != null && !request.name().isBlank()) lab.setName(request.name().trim());
        if (request.legalName() != null) lab.setLegalName(trim(request.legalName()));
        if (request.bin() != null) lab.setBin(trim(request.bin()));
        if (request.address() != null) lab.setAddress(trim(request.address()));
        if (request.phone() != null) lab.setPhone(trim(request.phone()));
        if (request.email() != null) lab.setEmail(trim(request.email()));
        if (request.accreditationNumber() != null) lab.setAccreditationNumber(trim(request.accreditationNumber()));
        if (request.accreditationIssuedAt() != null) {
            lab.setAccreditationIssuedAt(ProtocolApiMapper.parseDate(request.accreditationIssuedAt()));
        }
        if (request.accreditationValidUntil() != null) {
            lab.setAccreditationValidUntil(ProtocolApiMapper.parseDate(request.accreditationValidUntil()));
        }
        if (request.directorId() != null || request.directorName() != null) {
            applyLeadershipAssignment(lab.getId(), request.directorId(), request.directorName(), "директора",
                    lab::setDirectorId, lab::setDirectorName);
        }
        if (request.laboratoryHeadId() != null || request.laboratoryHeadName() != null) {
            applyLeadershipAssignment(lab.getId(), request.laboratoryHeadId(), request.laboratoryHeadName(), "заведующего",
                    lab::setLaboratoryHeadId, lab::setLaboratoryHeadName);
        }
        if (request.logoUrl() != null) lab.setLogoUrl(trim(request.logoUrl()));
        if (request.standardNote() != null) lab.setStandardNote(trim(request.standardNote()));
        if (request.active() != null) lab.setActive(request.active());
    }

    /**
     * Director/head assignment rule (see class javadoc-level ticket spec):
     * - an id is given -> the employee is validated (belongs to this lab, active) and its name
     *   is taken from the employee record, never trusted from the client;
     * - no id but a name is given -> that manual name is stored as-is (e.g. an external director
     *   who isn't a lab employee), clearing any previous id;
     * - a blank name with no id explicitly clears the assignment. Omitting both fields (the
     *   common PATCH case) never reaches this method at all - see the null-guard at the call site.
     */
    private void applyLeadershipAssignment(Long laboratoryId, Long employeeId, String manualName,
                                           String roleLabel,
                                           java.util.function.Consumer<Long> idSetter,
                                           java.util.function.Consumer<String> nameSetter) {
        if (employeeId != null) {
            LaboratoryEmployee employee = employeeRepository.findByIdAndLaboratoryId(employeeId, laboratoryId)
                    .orElseThrow(() -> new BadRequestException(
                            "Сотрудник для роли \"" + roleLabel + "\" не найден в этой лаборатории"));
            if (!employee.isActive()) {
                throw new BadRequestException("Сотрудник для роли \"" + roleLabel + "\" неактивен");
            }
            idSetter.accept(employee.getId());
            nameSetter.accept(employee.getFullName());
            return;
        }
        String trimmed = trim(manualName);
        idSetter.accept(null);
        nameSetter.accept(trimmed);
    }

    private LaboratoryDtos.LaboratoryResponse toResponse(Laboratory lab) {
        return new LaboratoryDtos.LaboratoryResponse(
                lab.getId(), lab.getName(), lab.getLegalName(), lab.getBin(), lab.getAddress(),
                lab.getPhone(), lab.getEmail(), lab.getAccreditationNumber(),
                ProtocolApiMapper.formatDate(lab.getAccreditationIssuedAt()),
                ProtocolApiMapper.formatDate(lab.getAccreditationValidUntil()),
                lab.getDirectorId(), lab.getDirectorName(),
                lab.getLaboratoryHeadId(), lab.getLaboratoryHeadName(),
                lab.getLogoUrl(), lab.getStandardNote(), lab.isDefault(), lab.isActive()
        );
    }

    private LaboratoryDtos.LaboratoryEmployeeResponse toEmployeeResponse(LaboratoryEmployee employee) {
        return new LaboratoryDtos.LaboratoryEmployeeResponse(
                employee.getId(), employee.getLaboratoryId(), employee.getUserId(),
                employee.getFullName(), employee.getPosition(), employee.getEmail(),
                employee.getRole(), employee.isActive(),
                employee.getPhone(), employee.getEmployeeNumber(), employee.getQualification(),
                employee.isCanExecuteMeasurements(), employee.isCanApproveProtocols(), employee.isCanSignProtocols(),
                employee.getDeactivatedAt() != null ? employee.getDeactivatedAt().toString() : null,
                employee.getVersion()
        );
    }

    private static String trim(String value) {
        return value != null ? value.trim() : null;
    }

    /** Small local helper so create()/update() share the same "collect field errors, throw once"
     *  shape used elsewhere in the app. */
    private static final class ValidationHelper {
        static void throwIfErrors(Map<String, String> errors) {
            if (!errors.isEmpty()) {
                throw new ValidationException("Некорректные данные лаборатории", errors);
            }
        }
    }
}
