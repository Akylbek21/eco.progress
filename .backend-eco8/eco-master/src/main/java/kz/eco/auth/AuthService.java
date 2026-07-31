package kz.eco.auth;

import kz.eco.auth.dto.AuthResponse;
import kz.eco.auth.dto.LoginRequest;
import kz.eco.auth.dto.RegisterRequest;
import kz.eco.client.Client;
import kz.eco.client.ClientRepository;
import kz.eco.common.exception.ConflictException;
import kz.eco.common.exception.UnauthorizedException;
import kz.eco.user.ClientType;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import kz.eco.user.UserRole;
import kz.eco.user.UserStatus;
import kz.eco.user.dto.UserResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    private final UserRepository userRepository;
    private final ClientRepository clientRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(UserRepository userRepository,
                       ClientRepository clientRepository,
                       PasswordEncoder passwordEncoder,
                       JwtService jwtService) {
        this.userRepository = userRepository;
        this.clientRepository = clientRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByEmailIgnoreCase(request.email())) {
            throw new ConflictException("Пользователь с таким email уже существует");
        }

        User user = new User();
        user.setEmail(request.email().trim().toLowerCase());
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setRole(UserRole.CLIENT);
        user.setType(request.clientType());
        user.setPhone(request.phone());
        user.setCity(request.city());

        if (request.clientType() == ClientType.individual) {
            user.setName(request.name());
        } else {
            user.setName(request.contactPerson());
            user.setCompanyName(request.companyName());
            user.setBin(request.bin());
            user.setOrganizationType(request.organizationType());
            user.setLegalAddress(request.legalAddress());
            user.setPosition(request.position());
        }
        user.setLastLoginAt(LocalDateTime.now());
        userRepository.save(user);

        Client client = new Client();
        client.setUser(user);
        client.setClientType(request.clientType());
        client.setEmail(user.getEmail());
        client.setPhone(user.getPhone());
        if (request.clientType() == ClientType.individual) {
            client.setContactPerson(request.name());
        } else {
            client.setCompanyName(request.companyName());
            client.setBinIin(request.bin());
            client.setContactPerson(request.contactPerson());
            client.setLegalAddress(request.legalAddress());
        }
        clientRepository.save(client);

        return new AuthResponse(jwtService.issue(user), UserResponse.from(user));
    }

    @Transactional
    public AuthResponse login(LoginRequest request, boolean staff) {
        User user = userRepository.findByEmailIgnoreCase(request.email())
                .orElseThrow(() -> new UnauthorizedException("Неверный email или пароль"));
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new UnauthorizedException("Неверный email или пароль");
        }
        ensureLoginAllowed(user);
        if (staff && !user.getRole().isStaffAccount()) {
            throw new UnauthorizedException("У пользователя нет доступа в кабинет сотрудника");
        }
        if (!staff && user.getRole().isStaffAccount()) {
            throw new UnauthorizedException("Войдите через кабинет сотрудника");
        }
        user.setLastLoginAt(LocalDateTime.now());
        userRepository.save(user);
        log.info("User login id={} role={} staff={}", user.getId(), user.getRole(), staff);
        return new AuthResponse(jwtService.issue(user), UserResponse.from(user));
    }

    private void ensureLoginAllowed(User user) {
        if (user.getStatus() == UserStatus.blocked) {
            throw new UnauthorizedException("Аккаунт заблокирован. Обратитесь к администратору");
        }
        if (user.getStatus() == UserStatus.deleted) {
            throw new UnauthorizedException("Аккаунт удалён. Обратитесь к администратору");
        }
        if (user.getStatus() != UserStatus.active) {
            throw new UnauthorizedException("Аккаунт недоступен. Обратитесь к администратору");
        }
    }
}
