package kz.eco;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.AutoConfigurationPackage;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * {@code scanBasePackages}/{@code @AutoConfigurationPackage}/{@code @EnableJpaRepositories}
 * explicitly include {@code kz.ecoprogress} (the "Документооборот" SaaS module) alongside the
 * original {@code kz.eco} root - it lives under a different top-level package on purpose (a
 * distinct product area), so without this it would be invisible to component/entity/repository
 * scanning entirely (Spring Boot's defaults only scan downward from this class's own package).
 * Spring Boot 4 removed {@code @EntityScan} - entity scanning here now rides on the directly
 * (not just meta-) declared {@code @AutoConfigurationPackage#basePackages}, which
 * JpaBaseConfiguration's PersistenceManagedTypes scanner reads instead.
 */
@SpringBootApplication(scanBasePackages = {"kz.eco", "kz.ecoprogress"})
@AutoConfigurationPackage(basePackages = {"kz.eco", "kz.ecoprogress"})
@EnableJpaRepositories(basePackages = {"kz.eco", "kz.ecoprogress"})
@EnableScheduling
public class EcoApplication {

    public static void main(String[] args) {
        SpringApplication.run(EcoApplication.class, args);
    }

}
