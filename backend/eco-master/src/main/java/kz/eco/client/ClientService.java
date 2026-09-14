package kz.eco.client;

import kz.eco.client.dto.CreateClientRequest;
import kz.eco.client.dto.CreateClientResponse;
import kz.eco.common.exception.ConflictException;
import kz.eco.user.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class ClientService {

    private final ClientRepository clientRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public ClientService(ClientRepository clientRepository,
                         UserRepository userRepository,
                         PasswordEncoder passwordEncoder) {
        this.clientRepository = clientRepository;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public CreateClientResponse createClient(CreateClientRequest request) {
        String email = request.email().trim().toLowerCase();
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new ConflictException("Пользователь с таким email уже существует");
        }

        String tempPassword = UUID.randomUUID().toString().substring(0, 8);

        ClientType clientType = request.clientType() != null
                ? ClientType.valueOf(request.clientType())
                : ClientType.company;

        User user = new User();
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(tempPassword));
        user.setRole(UserRole.CLIENT);
        user.setStatus(UserStatus.active);
        user.setType(clientType);
        user.setPhone(request.phone());
        user.setCompanyName(request.companyName());
        user.setBin(request.binIin());
        user.setLegalAddress(request.legalAddress());
        if (clientType == ClientType.individual) {
            user.setName(request.contactPerson());
        } else {
            user.setName(request.contactPerson());
            user.setCompanyName(request.companyName());
        }
        userRepository.save(user);

        Client client = new Client();
        client.setUser(user);
        client.setClientType(clientType);
        client.setCompanyName(request.companyName());
        client.setBinIin(request.binIin());
        client.setEmail(email);
        client.setPhone(request.phone());
        client.setContactPerson(request.contactPerson());
        client.setLegalAddress(request.legalAddress());
        clientRepository.save(client);

        return CreateClientResponse.from(client, tempPassword);
    }
}
