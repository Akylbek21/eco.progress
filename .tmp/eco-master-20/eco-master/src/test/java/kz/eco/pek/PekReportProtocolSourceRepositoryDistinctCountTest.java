package kz.eco.pek;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Task 1 fix coverage: {@link PekReportProtocolSourceRepository#countDistinctProtocolsByReportId}
 * must count distinct PROTOCOLS, never rows - the old {@code countByReportIdAndExcludedFalse} used
 * for {@code PekReport#linkedProtocolCount} counted rows, which double- (or many-times-) counts a
 * protocol that now legitimately owns more than one row (the whole-protocol row plus one per
 * matched/unmatched/ambiguous ProtocolResult, since collect() no longer skips unresolved results).
 * Pure repository-level test - no controller/version-workflow involved, so it is not affected by
 * the pre-existing test-harness auto-flush issue documented in the module report (see "Known
 * limitations" - PekProgramService workflow transitions read a stale in-memory version inside a
 * single non-committing @Transactional test method unless something forces an intermediate flush).
 */
@SpringBootTest
@Transactional
class PekReportProtocolSourceRepositoryDistinctCountTest {

    @Autowired
    private PekReportProtocolSourceRepository sourceRepository;

    private PekReportProtocolSource row(Long reportId, Long protocolId, Long protocolResultId,
                                         PekMatchStatus status, boolean excluded) {
        PekReportProtocolSource s = new PekReportProtocolSource();
        s.setReportId(reportId);
        s.setProtocolId(protocolId);
        s.setProtocolResultId(protocolResultId);
        s.setMatchStatus(status);
        s.setMatchType("AUTO");
        s.setExcluded(excluded);
        s.setMatchedAt(LocalDateTime.now());
        return sourceRepository.save(s);
    }

    @Test
    void zeroRows_countsZero() {
        assertEquals(0, sourceRepository.countDistinctProtocolsByReportId(999L));
    }

    @Test
    void oneWholeProtocolRow_countsOne() {
        row(1L, 100L, null, PekMatchStatus.MATCHED, false);
        assertEquals(1, sourceRepository.countDistinctProtocolsByReportId(1L));
    }

    @Test
    void oneProtocolWithMultipleResultRows_countsOneNotRowCount() {
        // The exact Task 1 bug: one protocol, one whole-protocol row plus three per-result rows
        // (MATCHED/UNMATCHED/AMBIGUOUS) - four rows total, but still one real protocol.
        row(2L, 200L, null, PekMatchStatus.MATCHED, false);
        row(2L, 200L, 201L, PekMatchStatus.MATCHED, false);
        row(2L, 200L, 202L, PekMatchStatus.UNMATCHED, false);
        row(2L, 200L, 203L, PekMatchStatus.AMBIGUOUS, false);
        assertEquals(1, sourceRepository.countDistinctProtocolsByReportId(2L));
    }

    @Test
    void multipleDistinctProtocols_countsEachOnce() {
        row(3L, 300L, null, PekMatchStatus.MATCHED, false);
        row(3L, 300L, 301L, PekMatchStatus.MATCHED, false);
        row(3L, 301L, null, PekMatchStatus.MATCHED, false);
        row(3L, 302L, null, PekMatchStatus.MATCHED, false);
        row(3L, 302L, 320L, PekMatchStatus.UNMATCHED, false);
        assertEquals(3, sourceRepository.countDistinctProtocolsByReportId(3L));
    }

    @Test
    void excludedRows_areNotCounted() {
        row(4L, 400L, null, PekMatchStatus.MATCHED, false);
        row(4L, 401L, null, PekMatchStatus.EXCLUDED, true);
        assertEquals(1, sourceRepository.countDistinctProtocolsByReportId(4L));
    }

    @Test
    void staleRowsAreNeverCountedEvenWhenLegacyExcludedFlagIsFalse() {
        row(5L, 500L, null, PekMatchStatus.STALE, false);
        row(5L, 501L, null, PekMatchStatus.MANUALLY_MATCHED, false);
        assertEquals(1, sourceRepository.countDistinctProtocolsByReportId(5L));
    }
}
