package kz.eco.user;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long>, JpaSpecificationExecutor<User> {
    Optional<User> findByEmailIgnoreCase(String email);

    boolean existsByEmailIgnoreCase(String email);

    boolean existsByEmailIgnoreCaseAndIdNot(String email, Long id);

    /** ИИН is a natural key for a person: two accounts must never claim the same one, or
     *  kz.eco.signaturedoc's IIN-match check could bind a signature to the wrong user. */
    boolean existsByIin(String iin);

    boolean existsByIinAndIdNot(String iin, Long id);

    List<User> findByRole(UserRole role);

    List<User> findByStatusNot(UserStatus status);

    List<User> findByRoleInAndStatusNot(List<UserRole> roles, UserStatus status);
}
