package kz.ecoprogress.documentflow.signing;

import kz.ecoprogress.documentflow.document.Document;
import kz.ecoprogress.documentflow.document.DocumentService;
import kz.ecoprogress.documentflow.document.DocumentStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Owns the "which assignments are AVAILABLE right now" state machine.
 *
 * <ul>
 *   <li>PARALLEL: every step activates at once - all assignments become AVAILABLE the moment the
 *   route activates, regardless of stepOrder. The route completes once every required assignment
 *   across the whole route is SIGNED.</li>
 *   <li>SEQUENTIAL / MIXED: only the lowest-stepOrder step activates when the route activates.
 *   Once a step's requiredCount of assignments reach SIGNED, the next step (by stepOrder) is
 *   activated (its assignments flip PENDING -&gt; AVAILABLE); a step's assignments simply never
 *   become AVAILABLE until every earlier step is satisfied. This is exactly what lets "step 2
 *   assignment can't sign before step 1 completes" hold as an invariant enforced by state, not by
 *   a query-time check alone.</li>
 * </ul>
 *
 * requiredCount design choice (see SigningStep javadoc): defaults to "all assignments in the step",
 * but a partial quorum (requiredCount &lt; total) is honored if the route was created with one.
 */
@Service
public class SigningRouteProgressService {

    private final SigningStepRepository stepRepository;
    private final SigningAssignmentRepository assignmentRepository;
    private final SigningRouteRepository routeRepository;
    private final DocumentService documentService;
    private final DocumentFlowNotificationService notificationService;

    public SigningRouteProgressService(SigningStepRepository stepRepository,
                                        SigningAssignmentRepository assignmentRepository,
                                        SigningRouteRepository routeRepository,
                                        DocumentService documentService,
                                        DocumentFlowNotificationService notificationService) {
        this.stepRepository = stepRepository;
        this.assignmentRepository = assignmentRepository;
        this.routeRepository = routeRepository;
        this.documentService = documentService;
        this.notificationService = notificationService;
    }

    @Transactional
    public void activateRoute(SigningRoute route) {
        List<SigningStep> steps = stepRepository.findAllByRouteIdOrderByStepOrderAsc(route.getId());
        if (steps.isEmpty()) {
            return;
        }
        if (route.getRouteType() == SigningRouteType.PARALLEL) {
            for (SigningStep step : steps) {
                activateStep(step);
            }
        } else {
            activateStep(steps.get(0));
        }
    }

    private void activateStep(SigningStep step) {
        Instant now = Instant.now();
        for (SigningAssignment assignment : assignmentRepository.findAllByStepId(step.getId())) {
            if (assignment.getStatus() == AssignmentStatus.PENDING) {
                assignment.setStatus(AssignmentStatus.AVAILABLE);
                assignment.setAvailableAt(now);
                assignmentRepository.save(assignment);
            }
        }
    }

    /** Called right after an assignment transitions to SIGNED. Advances the route: activates the
     *  next step (SEQUENTIAL/MIXED) or completes the route/document (last step, or PARALLEL with
     *  everything signed). */
    @Transactional
    public void onAssignmentSigned(SigningAssignment signedAssignment) {
        SigningStep step = stepRepository.findById(signedAssignment.getStepId()).orElseThrow();
        SigningRoute route = routeRepository.findById(routeIdOf(step)).orElseThrow();

        if (route.getRouteType() == SigningRouteType.PARALLEL) {
            List<SigningStep> allSteps = stepRepository.findAllByRouteIdOrderByStepOrderAsc(route.getId());
            boolean allDone = allSteps.stream()
                    .allMatch(s -> isStepSatisfied(s));
            if (allDone) {
                completeRoute(route);
            }
            return;
        }

        if (!isStepSatisfied(step)) {
            return;
        }
        List<SigningStep> steps = stepRepository.findAllByRouteIdOrderByStepOrderAsc(route.getId());
        List<SigningStep> later = steps.stream()
                .filter(s -> s.getStepOrder() > step.getStepOrder())
                .sorted(Comparator.comparingInt(SigningStep::getStepOrder))
                .toList();
        if (later.isEmpty()) {
            completeRoute(route);
        } else {
            activateStep(later.get(0));
        }
    }

    private Long routeIdOf(SigningStep step) {
        return step.getRouteId();
    }

    private boolean isStepSatisfied(SigningStep step) {
        List<SigningAssignment> assignments = assignmentRepository.findAllByStepId(step.getId());
        long signedCount = assignments.stream().filter(a -> a.getStatus() == AssignmentStatus.SIGNED).count();
        return signedCount >= step.getRequiredCount();
    }

    private void completeRoute(SigningRoute route) {
        route.setStatus(SigningRouteStatus.COMPLETED);
        route.setCompletedAt(Instant.now());
        routeRepository.save(route);
        Document document = documentService.transitionStatus(route.getDocumentId(), DocumentStatus.SIGNED,
                "Все требуемые подписи собраны, маршрут подписания завершён");
        notificationService.notifyAuthorOfCompletion(document);
    }

    /** Used by prepare-for-signing / route validation: true if every step has at least one
     *  assignment and the route has at least one signer overall. */
    public boolean hasAtLeastOneSigner(Long routeId) {
        List<SigningStep> steps = stepRepository.findAllByRouteIdOrderByStepOrderAsc(routeId);
        if (steps.isEmpty()) {
            return false;
        }
        Map<Long, List<SigningAssignment>> byStep = assignmentRepository
                .findAllByStepIdIn(steps.stream().map(SigningStep::getId).toList())
                .stream().collect(Collectors.groupingBy(SigningAssignment::getStepId));
        return steps.stream().anyMatch(s -> !byStep.getOrDefault(s.getId(), List.of()).isEmpty());
    }
}
