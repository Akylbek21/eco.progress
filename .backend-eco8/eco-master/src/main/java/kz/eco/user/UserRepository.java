package kz.eco.user;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmailIgnoreCase(String email);

    boolean existsByEmailIgnoreCase(String email);

    List<User> findByRole(UserRole role);

    List<User> findByStatusNot(UserStatus status);

    List<User> findByRoleInAndStatusNot(List<UserRole> roles, UserStatus status);
}
