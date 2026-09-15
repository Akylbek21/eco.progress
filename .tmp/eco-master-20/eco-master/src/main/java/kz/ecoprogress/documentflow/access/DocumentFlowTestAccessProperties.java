package kz.ecoprogress.documentflow.access;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.Set;

/**
 * Backs the {@code document-flow.access.*} / {@code document-flow.signing.*} /
 * {@code document-flow.storage.*} properties - a narrow, explicit DEV/TEST bypass for the
 * "Документооборот" module so it can be exercised end-to-end before an organization has a real
 * paid subscription. See {@link DocumentFlowTestAccessGuard} for the hard production block and
 * {@link DocumentFlowAccessServiceImpl} for where this is actually consulted (only ever as an
 * additional way to SATISFY the subscription gate for an allowlisted org+user that already has a
 * real, active {@code document_flow_memberships} row - it never substitutes for membership itself,
 * so tenant isolation is unaffected).
 */
@Component
@ConfigurationProperties(prefix = "document-flow")
public class DocumentFlowTestAccessProperties {

    private final Access access = new Access();
    private final Signing signing = new Signing();
    private final Storage storage = new Storage();

    public Access getAccess() { return access; }
    public Signing getSigning() { return signing; }
    public Storage getStorage() { return storage; }

    public static class Access {
        private boolean testModeEnabled = false;
        private Set<Long> allowedUserIds = Set.of();
        private Set<String> allowedEmails = Set.of();
        private Set<Long> allowedOrganizationIds = Set.of();

        public boolean isTestModeEnabled() { return testModeEnabled; }
        public void setTestModeEnabled(boolean testModeEnabled) { this.testModeEnabled = testModeEnabled; }
        public Set<Long> getAllowedUserIds() { return allowedUserIds; }
        public void setAllowedUserIds(Set<Long> allowedUserIds) { this.allowedUserIds = allowedUserIds; }
        public Set<String> getAllowedEmails() { return allowedEmails; }
        public void setAllowedEmails(Set<String> allowedEmails) {
            this.allowedEmails = allowedEmails.stream().map(String::toLowerCase).collect(java.util.stream.Collectors.toSet());
        }
        public Set<Long> getAllowedOrganizationIds() { return allowedOrganizationIds; }
        public void setAllowedOrganizationIds(Set<Long> allowedOrganizationIds) { this.allowedOrganizationIds = allowedOrganizationIds; }
    }

    public static class Signing {
        private boolean mockEnabled = false;

        public boolean isMockEnabled() { return mockEnabled; }
        public void setMockEnabled(boolean mockEnabled) { this.mockEnabled = mockEnabled; }
    }

    public static class Storage {
        private boolean mockAntivirusEnabled = false;

        public boolean isMockAntivirusEnabled() { return mockAntivirusEnabled; }
        public void setMockAntivirusEnabled(boolean mockAntivirusEnabled) { this.mockAntivirusEnabled = mockAntivirusEnabled; }
    }
}
