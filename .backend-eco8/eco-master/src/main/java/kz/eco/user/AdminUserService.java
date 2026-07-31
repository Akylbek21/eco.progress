package kz.eco.user;

import kz.eco.client.Client;
import kz.eco.client.ClientRepository;
import kz.eco.common.exception.BadRequestException;
import kz.eco.common.exception.ConflictException;
import kz.eco.common.exception.NotFoundException;
import kz.eco.user.dto.AdminUserCreateRequest;
import kz.eco.user.dto.AdminUserResponse;
import kz.eco.user.dto.AdminUserStatusRequest;
import kz.eco.user.dto.AdminUserUpdateRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;

@Service
public class AdminUserService {

    private static final Logger log = LoggerFactory.getLogger(AdminUserService.class);

    private final UserRepository userRepository;
    private final ClientRepository clientRepository;
    private final PasswordEncoder passwordEncoder;

    public AdminUserService(UserRepository userRepository,
                            ClientRepository clientRepository,
                            PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.clientRepository = clientRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional(readOnly = true)
    public List<AdminUserResponse> getUsers() {
        return userRepository.findByStatusNot(UserStatus.deleted).stream()
                .sorted(Comparator.comparing(User::getCreatedAt).reversed())
                .map(AdminUserResponse::from)
                .toList();
    }

    @Transactional
    public AdminUserResponse createUser(AdminUserCreateRequest request) {
        String email = normalizeEmail(request.email());
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new ConflictException("Пользователь с таким email уже существует");
        }

        UserRole role = parseRole(request.role());
        ClientType type = resolveType(role, request.type());
        UserStatus status = parseCreateStatus(request.status());
        validateBusinessRules(role, type, request.name(), request.phone(), request.city(),
                request.companyName(), request.bin(), request.position(), status);

        User user = new User();
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setStatus(status);
        applyProfile(user, role, type, request.name(), request.phone(), request.city(),
                request.companyName(), request.bin(), request.organizationType(),
                request.legalAddress(), request.position());
        userRepository.save(user);

        if (role == UserRole.CLIENT) {
            syncClientProfile(user, type);
        }

        log.info("Admin created user id={} email={} role={}", user.getId(), user.getEmail(), user.getRole());
        return AdminUserResponse.from(user);
    }

    @Transactional
    public AdminUserResponse updateUser(Long id, AdminUserUpdateRequest request) {
        User user = getUserOrThrow(id);
        if (user.getStatus() == UserStatus.deleted) {
            throw new BadRequestException("Нельзя редактировать удалённого пользователя");
        }

        if (request.email() != null && !request.email().isBlank()) {
            String email = normalizeEmail(request.email());
            if (!email.equalsIgnoreCase(user.getEmail())
                    && userRepository.existsByEmailIgnoreCase(email)) {
                throw new ConflictException("Пользователь с таким email уже существует");
            }
            user.setEmail(email);
        }

        UserRole role = request.role() != null && !request.role().isBlank()
                ? parseRole(request.role())
                : user.getRole();
        if (user.getRole() == UserRole.ADMIN && role != UserRole.ADMIN
                && user.getStatus() == UserStatus.active) {
            ensureNotLastActiveAdmin(user, "изменить роль последнего");
        }

        ClientType type = request.type() != null && !request.type().isBlank()
                ? resolveType(role, request.type())
                : user.getType();

        String name = request.name() != null && !request.name().isBlank()
                ? request.name().trim()
                : user.getName();
        String companyName = request.companyName() != null ? trimToNull(request.companyName()) : user.getCompanyName();
        String bin = request.bin() != null ? trimToNull(request.bin()) : user.getBin();
        String position = request.position() != null ? trimToNull(request.position()) : user.getPosition();
        String phone = request.phone() != null ? request.phone() : user.getPhone();
        String city = request.city() != null ? request.city() : user.getCity();
        UserStatus status = user.getStatus();

        if (request.status() != null && !request.status().isBlank()) {
            status = parseMutableStatus(request.status());
            if (status == UserStatus.blocked && user.getRole() == UserRole.ADMIN
                    && user.getStatus() == UserStatus.active) {
                ensureNotLastActiveAdmin(user, "заблокировать последнего");
            }
        }

        validateBusinessRules(role, type, name, phone, city, companyName, bin, position, status);

        user.setRole(role);
        user.setType(type);
        user.setStatus(status);
        applyProfile(user, role, type, name, phone, city,
                companyName, bin,
                request.organizationType() != null ? request.organizationType() : user.getOrganizationType(),
                request.legalAddress() != null ? request.legalAddress() : user.getLegalAddress(),
                position);

        if (request.password() != null && !request.password().isBlank()) {
            user.setPasswordHash(passwordEncoder.encode(request.password()));
        }

        userRepository.save(user);

        if (role == UserRole.CLIENT) {
            syncClientProfile(user, type);
        }

        log.info("Admin updated user id={}", user.getId());
        return AdminUserResponse.from(user);
    }

    @Transactional
    public AdminUserResponse changeStatus(Long id, AdminUserStatusRequest request, Long actorUserId) {
        User user = getUserOrThrow(id);
        if (user.getStatus() == UserStatus.deleted) {
            throw new BadRequestException("Нельзя изменить статус удалённого пользователя");
        }

        UserStatus newStatus = parseStatusChange(request.status());

        if (actorUserId != null && actorUserId.equals(user.getId()) && newStatus == UserStatus.blocked) {
            throw new BadRequestException("Нельзя заблокировать свой собственный аккаунт");
        }
        if (user.getRole() == UserRole.ADMIN && newStatus == UserStatus.blocked
                && user.getStatus() == UserStatus.active) {
            ensureNotLastActiveAdmin(user, "заблокировать последнего");
        }

        user.setStatus(newStatus);
        userRepository.save(user);
        log.info("Admin changed user id={} status to {}", user.getId(), newStatus);
        return AdminUserResponse.from(user);
    }

    @Transactional
    public void deleteUser(Long id, Long actorUserId) {
        User user = getUserOrThrow(id);
        if (user.getStatus() == UserStatus.deleted) {
            throw new BadRequestException("Пользователь уже удалён");
        }
        if (actorUserId != null && actorUserId.equals(user.getId())) {
            throw new BadRequestException("Нельзя удалить свой собственный аккаунт");
        }
        if (user.getRole() == UserRole.ADMIN && user.getStatus() == UserStatus.active) {
            ensureNotLastActiveAdmin(user, "удалить последнего");
        }

        user.setStatus(UserStatus.deleted);
        userRepository.save(user);
        log.info("Admin soft-deleted user id={}", user.getId());
    }

    private void applyProfile(User user, UserRole role, ClientType type, String name,
                              String phone, String city, String companyName, String bin,
                              String organizationType, String legalAddress, String position) {
        user.setName(name != null ? name.trim() : null);
        user.setRole(role);
        user.setType(type);
        user.setPhone(trimToNull(phone));
        user.setCity(trimToNull(city));
        user.setCompanyName(trimToNull(companyName));
        user.setBin(trimToNull(bin));
        user.setOrganizationType(trimToNull(organizationType));
        user.setLegalAddress(trimToNull(legalAddress));
        user.setPosition(trimToNull(position));
    }

    private void syncClientProfile(User user, ClientType type) {
        Client client = clientRepository.findByUserId(user.getId()).orElseGet(() -> {
            Client created = new Client();
            created.setUser(user);
            return created;
        });
        client.setClientType(type);
        client.setEmail(user.getEmail());
        client.setPhone(user.getPhone());
        if (type == ClientType.individual) {
            client.setContactPerson(user.getName());
            client.setCompanyName(null);
            client.setBinIin(null);
        } else {
            client.setCompanyName(user.getCompanyName());
            client.setBinIin(user.getBin());
            client.setContactPerson(user.getName());
            client.setLegalAddress(user.getLegalAddress());
        }
        clientRepository.save(client);
    }

    private User getUserOrThrow(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Пользователь не найден: " + id));
    }

    private void ensureNotLastActiveAdmin(User user, String action) {
        if (user.getRole() != UserRole.ADMIN || user.getStatus() != UserStatus.active) {
            return;
        }
        long activeAdmins = countActiveAdmins();
        if (activeAdmins <= 1) {
            throw new BadRequestException("Нельзя " + action + " активного администратора");
        }
    }

    private long countActiveAdmins() {
        return userRepository.findByRole(UserRole.ADMIN).stream()
                .filter(u -> u.getStatus() == UserStatus.active)
                .count();
    }

    private UserRole parseRole(String raw) {
        try {
            UserRole role = UserRole.valueOf(raw.trim().toUpperCase());
            if (role != UserRole.CLIENT && !role.isStaffAccount()) {
                throw new IllegalArgumentException();
            }
            return role;
        } catch (Exception ex) {
            throw new BadRequestException(
                    "Недопустимая роль. Допустимо: ADMIN, DIRECTOR, HEAD, MANAGER, ACCOUNTANT, "
                            + "ECOLOGIST, LABORATORY, WASTE_SPECIALIST, CLIENT");
        }
    }

    private UserStatus parseCreateStatus(String raw) {
        if (raw == null || raw.isBlank()) {
            return UserStatus.active;
        }
        return parseMutableStatus(raw);
    }

    private UserStatus parseMutableStatus(String raw) {
        return switch (raw.trim().toLowerCase()) {
            case "active" -> UserStatus.active;
            case "blocked" -> UserStatus.blocked;
            default -> throw new BadRequestException("Недопустимый status. Допустимо: active, blocked");
        };
    }

    private UserStatus parseStatusChange(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new BadRequestException("Укажите status");
        }
        return parseMutableStatus(raw);
    }

    private ClientType resolveType(UserRole role, String rawType) {
        if (role == UserRole.CLIENT) {
            if (rawType == null || rawType.isBlank()) {
                throw new BadRequestException("Для клиента нужно указать type: individual или company");
            }
            return switch (rawType.trim().toLowerCase()) {
                case "individual", "person", "physical" -> ClientType.individual;
                case "company", "legal", "organization" -> ClientType.company;
                default -> throw new BadRequestException("Недопустимый type. Допустимо: individual, company");
            };
        }
        if (role == UserRole.ADMIN) {
            return ClientType.admin;
        }
        return ClientType.staff;
    }

    private void validateBusinessRules(UserRole role, ClientType type,
                                       String name, String phone, String city,
                                       String companyName, String bin, String position,
                                       UserStatus status) {
        if (name == null || name.isBlank()) {
            throw new BadRequestException("Укажите name");
        }
        if (status == UserStatus.deleted) {
            throw new BadRequestException("Нельзя создать пользователя со статусом deleted");
        }
        if (role == UserRole.CLIENT) {
            if (isBlank(phone)) {
                throw new BadRequestException("Для клиента укажите phone");
            }
            if (type == ClientType.company) {
                if (isBlank(companyName)) {
                    throw new BadRequestException("Для юридического лица укажите companyName");
                }
                if (isBlank(bin)) {
                    throw new BadRequestException("Для юридического лица укажите bin");
                }
            }
            return;
        }
        if (!role.isStaffAccount()) {
            throw new BadRequestException("Роль " + role + " нельзя назначить через админку");
        }
        if (isBlank(phone)) {
            throw new BadRequestException("Для сотрудника укажите phone");
        }
        if (isBlank(city)) {
            throw new BadRequestException("Для сотрудника укажите city");
        }
        if (isBlank(position)) {
            throw new BadRequestException("Для сотрудника укажите position");
        }
    }

    private static String normalizeEmail(String email) {
        if (email == null || email.isBlank()) {
            throw new BadRequestException("Укажите email");
        }
        return email.trim().toLowerCase();
    }

    private static String trimToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
