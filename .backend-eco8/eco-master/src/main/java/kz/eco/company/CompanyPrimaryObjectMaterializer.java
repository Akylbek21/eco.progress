package kz.eco.company;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Split into its own bean (not a private method on CompanyService) so the REQUIRES_NEW attempt
 * below is invoked through the Spring AOP proxy - a self-invoked {@code @Transactional} method on
 * the same bean is silently NOT proxied, and the propagation setting would be ignored. Same
 * pattern as LabJournalRowCounterService/LabJournalRowCounterTransactionalOps.
 */
@Service
public class CompanyPrimaryObjectMaterializer {

    private final CompanyObjectRepository objectRepository;

    public CompanyPrimaryObjectMaterializer(CompanyObjectRepository objectRepository) {
        this.objectRepository = objectRepository;
    }

    /**
     * Creates the primary object for a company that has none, in its own transaction. If a
     * concurrent request already created one (unique-index violation on the primary-object
     * emulation), this throws DataIntegrityViolationException and only THIS nested transaction
     * rolls back - the caller retries and finds the winner's row instead of racing again.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public CompanyObject materialize(Long companyId, String name, String address, String activityType,
                                      String samplingLocation, String notes, String status) {
        CompanyObject obj = new CompanyObject();
        obj.setCompanyId(companyId);
        obj.setName(name);
        obj.setAddress(address);
        obj.setActivityType(activityType);
        obj.setSamplingLocation(samplingLocation);
        obj.setNotes(notes);
        obj.setStatus(status);
        obj.setPrimary(true);
        return objectRepository.saveAndFlush(obj);
    }
}
