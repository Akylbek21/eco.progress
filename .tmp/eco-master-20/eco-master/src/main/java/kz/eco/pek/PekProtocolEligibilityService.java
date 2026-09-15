package kz.eco.pek;

import kz.eco.common.exception.BadRequestException;
import kz.eco.protocol.Protocol;
import kz.eco.protocol.ProtocolResultRepository;
import kz.eco.protocol.ProtocolStatus;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/** Single eligibility policy used by automatic collection and manual source mutations. */
@Service
public class PekProtocolEligibilityService {
    private static final Set<ProtocolStatus> FINALIZED =
            Set.of(ProtocolStatus.APPROVED, ProtocolStatus.SIGNED);
    private final ProtocolResultRepository results;
    private final PekSettingsService settings;

    public PekProtocolEligibilityService(ProtocolResultRepository results, PekSettingsService settings) {
        this.results = results;
        this.settings = settings;
    }

    public Eligibility evaluate(PekReport report, Protocol protocol, boolean requireResults) {
        List<String> issues = new ArrayList<>();
        if (!report.getCompanyId().equals(protocol.getCompanyId())) issues.add("COMPANY_MISMATCH");
        if (!report.getObjectId().equals(protocol.getObjectId())) issues.add("OBJECT_MISMATCH");
        if (protocol.getProtocolDate() == null || protocol.getProtocolDate().isBefore(report.getPeriodStart())
                || protocol.getProtocolDate().isAfter(report.getPeriodEnd())) issues.add("OUTSIDE_REPORT_PERIOD");
        if (protocol.getDeletedAt() != null) issues.add("DELETED");
        if (protocol.getStatus() == ProtocolStatus.REPLACED || protocol.getReplacedByProtocolId() != null) issues.add("REPLACED");
        if (protocol.getStatus() == ProtocolStatus.CANCELLED || protocol.getStatus() == ProtocolStatus.ARCHIVED) issues.add("CANCELLED_OR_ARCHIVED");
        boolean signedOnly = settings.getEffectiveSettings(report.getCompanyId()).isIncludeOnlySignedProtocols();
        if (signedOnly ? protocol.getStatus() != ProtocolStatus.SIGNED : !FINALIZED.contains(protocol.getStatus())) issues.add("NOT_FINALIZED");
        if (requireResults && results.countByProtocolId(protocol.getId()) == 0) issues.add("NO_RESULTS");
        return new Eligibility(issues.isEmpty(), List.copyOf(issues));
    }

    public void requireEligible(PekReport report, Protocol protocol, boolean requireResults) {
        Eligibility result = evaluate(report, protocol, requireResults);
        if (!result.eligible()) throw new BadRequestException(
                "Протокол не может быть источником отчёта ПЭК: " + String.join(", ", result.issues()),
                "PEK_PROTOCOL_NOT_ELIGIBLE");
    }

    public record Eligibility(boolean eligible, List<String> issues) {}
}
