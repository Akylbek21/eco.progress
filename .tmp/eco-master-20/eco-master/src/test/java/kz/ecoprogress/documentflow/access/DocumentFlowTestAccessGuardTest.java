package kz.ecoprogress.documentflow.access;

import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

class DocumentFlowTestAccessGuardTest {

    @Test
    void testModeEnabled_underDockerProfile_refusesToStart() {
        DocumentFlowTestAccessProperties properties = new DocumentFlowTestAccessProperties();
        properties.getAccess().setTestModeEnabled(true);
        MockEnvironment env = new MockEnvironment();
        env.setActiveProfiles("docker");

        DocumentFlowTestAccessGuard guard = new DocumentFlowTestAccessGuard(properties, env);
        assertThrows(IllegalStateException.class, guard::run);
    }

    @Test
    void testModeEnabled_underDevProfile_startsFine() {
        DocumentFlowTestAccessProperties properties = new DocumentFlowTestAccessProperties();
        properties.getAccess().setTestModeEnabled(true);
        MockEnvironment env = new MockEnvironment();
        env.setActiveProfiles("dev");

        DocumentFlowTestAccessGuard guard = new DocumentFlowTestAccessGuard(properties, env);
        assertDoesNotThrow(() -> { guard.run(); });
    }

    @Test
    void testModeDisabled_underDockerProfile_startsFine() {
        DocumentFlowTestAccessProperties properties = new DocumentFlowTestAccessProperties();
        MockEnvironment env = new MockEnvironment();
        env.setActiveProfiles("docker");

        DocumentFlowTestAccessGuard guard = new DocumentFlowTestAccessGuard(properties, env);
        assertDoesNotThrow(() -> { guard.run(); });
    }
}
