package kz.ecoprogress.documentflow.signing;

import kz.eco.storage.FileStorageService;
import kz.ecoprogress.documentflow.document.Document;
import kz.ecoprogress.documentflow.document.DocumentDirection;
import kz.ecoprogress.documentflow.document.DocumentRepository;
import kz.ecoprogress.documentflow.document.DocumentStatus;
import kz.ecoprogress.documentflow.document.DocumentType;
import kz.ecoprogress.documentflow.membership.DocumentFlowMembership;
import kz.ecoprogress.documentflow.membership.DocumentFlowMembershipRepository;
import kz.ecoprogress.documentflow.membership.MembershipRole;
import kz.ecoprogress.documentflow.membership.MembershipStatus;
import kz.ecoprogress.documentflow.plan.SubscriptionPlanRepository;
import kz.ecoprogress.documentflow.subscription.OrganizationSubscription;
import kz.ecoprogress.documentflow.subscription.OrganizationSubscriptionRepository;
import kz.ecoprogress.documentflow.subscription.PaymentMode;
import kz.ecoprogress.documentflow.subscription.SubscriptionStatus;
import kz.ecoprogress.documentflow.version.DocumentVersion;
import kz.ecoprogress.documentflow.version.DocumentVersionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.HexFormat;

@Component
public class DocumentFlowTestFixtures {

    @Autowired
    private DocumentRepository documentRepository;
    @Autowired
    private DocumentVersionRepository versionRepository;
    @Autowired
    private FileStorageService fileStorageService;
    @Autowired
    private DocumentFlowMembershipRepository membershipRepository;
    @Autowired
    private OrganizationSubscriptionRepository subscriptionRepository;
    @Autowired
    private SubscriptionPlanRepository planRepository;

    /** Grants userId a full-access (OWNER, ACTIVE) membership plus an ACTIVE ENTERPRISE-plan
     *  subscription (unlimited plan_features - see V38/V39 seed data) for organizationId, so
     *  DocumentFlowAccessServiceImpl.requireWriteAccess/hasFeature/hasPermission all pass. */
    public void grantFullAccess(Long userId, Long organizationId) {
        DocumentFlowMembership membership = new DocumentFlowMembership();
        membership.setUserId(userId);
        membership.setOrganizationId(organizationId);
        membership.setRoleCode(MembershipRole.OWNER);
        membership.setStatus(MembershipStatus.ACTIVE);
        membershipRepository.save(membership);

        Long planId = planRepository.findByCode("ENTERPRISE").orElseThrow().getId();
        OrganizationSubscription subscription = new OrganizationSubscription();
        subscription.setOrganizationId(organizationId);
        subscription.setPlanId(planId);
        subscription.setStatus(SubscriptionStatus.ACTIVE);
        subscription.setStartsAt(LocalDateTime.now().minusDays(1));
        subscription.setExpiresAt(LocalDateTime.now().plusYears(1));
        subscription.setPaymentMode(PaymentMode.ADMIN_GRANT);
        subscriptionRepository.save(subscription);
    }

    public Document createDocument(Long organizationId) {
        Document document = new Document();
        document.setOrganizationId(organizationId);
        document.setStatus(DocumentStatus.DRAFT);
        document.setTitle("Test document " + System.nanoTime());
        document.setDocumentType(DocumentType.CONTRACT);
        document.setDirection(DocumentDirection.INTERNAL);
        document.setAuthorUserId(1L);
        // saveAndFlush (not save): this project's Hibernate version can delay the actual INSERT
        // for an IDENTITY-generated id past a plain save() call, leaving document.getId() null
        // until the next flush - the fixture needs the id immediately to build a DocumentVersion
        // against it, so force the flush here (same pattern as ProtocolService.saveProtocolWithNumberRetry).
        documentRepository.saveAndFlush(document);
        return document;
    }

    public DocumentVersion createVersion(Document document, byte[] content) {
        try {
            String fileId = fileStorageService.storeBytes(content, "document.bin", "application/octet-stream",
                    "document-flow-test", "test").fileId();
            DocumentVersion version = new DocumentVersion();
            version.setDocumentId(document.getId());
            version.setVersionNumber(1);
            version.setStorageKey(fileId);
            version.setOriginalFileName("document.bin");
            version.setMimeType("application/octet-stream");
            version.setFileSize(content.length);
            version.setSha256Hash(sha256Hex(content));
            version.setCurrent(true);
            version.setCreatedBy(1L);
            versionRepository.saveAndFlush(version);
            document.setCurrentVersionId(version.getId());
            documentRepository.saveAndFlush(document);
            return version;
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }

    public static String sha256Hex(byte[] data) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(data));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
