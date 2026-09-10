package kz.eco.pek;

import kz.eco.common.exception.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Module fix item 4: "любое изменение дочернего раздела программы должно увеличивать
 *  program.version/contentRevision" - the single call every child-section service (monitoring,
 *  monitoring points, control items/indicators/measures, internal inspections, measurement QA,
 *  emergency procedures, responsibility structure, documents) makes after its own mutation.
 *  {@code contentRevision} is a separate explicit counter from JPA's {@code @Version} - version
 *  is optimistic-locking machinery (compared on every If-Match check), contentRevision is a
 *  business-visible "how many times has this program's content actually changed" figure that
 *  survives being read/exposed to the frontend without being confused for a lock token. Both
 *  increment together here since saving the program bumps its own @Version too.
 *
 *  Also cascades contentRevision bumps to all reports under the program so that any previously
 *  generated document version (which stores sourceContentRevision = report.contentRevision at
 *  generation time) becomes stale after a program-level mutation. */
@Service
public class PekProgramContentRevisionService {

    private final PekProgramRepository programRepository;
    private final PekReportRepository reportRepository;

    public PekProgramContentRevisionService(PekProgramRepository programRepository,
                                             PekReportRepository reportRepository) {
        this.programRepository = programRepository;
        this.reportRepository = reportRepository;
    }

    @Transactional
    public void bump(Long programId) {
        PekProgram program = programRepository.findById(programId)
                .orElseThrow(() -> new NotFoundException("Программа ПЭК не найдена: " + programId));
        program.setContentRevision(program.getContentRevision() + 1);
        programRepository.saveAndFlush(program);

        // Cascade: bump contentRevision on every report under this program so that previously
        // generated document versions (stored with sourceContentRevision = report.contentRevision)
        // become stale and must be regenerated.
        for (PekReport report : reportRepository.findByProgramId(programId)) {
            long next = (report.getContentRevision() == null ? 0L : report.getContentRevision()) + 1;
            report.setContentRevision(next);
            reportRepository.save(report);
        }
    }
}
