package kz.eco.system;

import kz.eco.common.ApiResponse;
import kz.eco.user.SecurityExpressions;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.info.BuildProperties;
import org.springframework.core.env.Environment;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Minimal build/version visibility so an operator can confirm which build is actually running in
 * a given environment, without shelling into the container - task item 15/18. Backed by
 * spring-boot-maven-plugin's build-info goal (see pom.xml), which generates
 * META-INF/build-info.properties at package time and gets auto-wired into a BuildProperties bean
 * by Spring Boot when present. No git-commit-id-maven-plugin was added (kept out to keep this
 * change isolated/low-risk); gitCommit is populated from the git.commit build-info property,
 * which is "unknown" unless the build passes -Dgit.commit=$(git rev-parse HEAD) - see
 * docs/normative-search-deployment-verification.md.
 *
 * Gated the same way other internal/administrative read endpoints are (SecurityExpressions.STAFF)
 * rather than permitAll - build/version metadata is low-sensitivity but still not something an
 * unauthenticated caller needs.
 */
@RestController
@RequestMapping("/api/system")
public class SystemVersionController {

    // ObjectProvider, not a required constructor dependency: BuildProperties is only registered
    // when META-INF/build-info.properties is on the classpath, which spring-boot-maven-plugin's
    // build-info goal generates at the "prepare-package" phase - it does NOT exist during `mvn
    // test` (test runs before package). A required BuildProperties dependency would fail the
    // whole Spring context to start in every test in the project, not just ones touching this
    // endpoint. Falling back to "unknown"/null values instead lets the endpoint degrade gracefully
    // in that case (and in local `mvn spring-boot:run` without a full `package`) rather than
    // taking down app startup.
    private final ObjectProvider<BuildProperties> buildProperties;
    private final Environment environment;

    public SystemVersionController(ObjectProvider<BuildProperties> buildProperties, Environment environment) {
        this.buildProperties = buildProperties;
        this.environment = environment;
    }

    @GetMapping("/version")
    @PreAuthorize(SecurityExpressions.STAFF)
    public ApiResponse<Map<String, Object>> version() {
        BuildProperties props = buildProperties.getIfAvailable();
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("name", props != null ? props.getName() : null);
        payload.put("version", props != null ? props.getVersion() : "unknown");
        payload.put("buildTime", props != null ? props.getTime() : null);
        payload.put("gitCommit", props != null ? props.get("git.commit") : "unknown");
        payload.put("activeProfiles", environment.getActiveProfiles());
        return ApiResponse.ok(payload, "OK");
    }
}
