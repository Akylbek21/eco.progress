package kz.ecoprogress.documentflow.access;

import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import java.util.Arrays;

/**
 * Hard production block for {@code document-flow.access.test-mode-enabled}. This repository's only
 * production profile is {@code docker} (see docker-compose.yml / Dockerfile:
 * {@code SPRING_PROFILES_ACTIVE=docker}) - everything else (default/no profile, or an explicit
 * {@code local}/{@code dev}/{@code test}/{@code staging} profile someone adds later) is allowed to
 * enable it. Belt-and-suspenders on top of application-docker.properties hardcoding the flag to
 * false: even if that file is ever edited incorrectly, or the env var is injected directly into the
 * docker container bypassing the properties file, startup still refuses rather than silently
 * granting free module access in production.
 */
@Component
@Order(Integer.MIN_VALUE)
public class DocumentFlowTestAccessGuard implements CommandLineRunner {

    private static final String PRODUCTION_PROFILE = "docker";

    private final DocumentFlowTestAccessProperties properties;
    private final Environment environment;

    public DocumentFlowTestAccessGuard(DocumentFlowTestAccessProperties properties, Environment environment) {
        this.properties = properties;
        this.environment = environment;
    }

    @Override
    public void run(String... args) {
        if (properties.getAccess().isTestModeEnabled() && isProductionProfile()) {
            throw new IllegalStateException("Document flow test access cannot be enabled in production");
        }
    }

    boolean isProductionProfile() {
        return Arrays.asList(environment.getActiveProfiles()).contains(PRODUCTION_PROFILE);
    }
}
