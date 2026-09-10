package kz.ecoprogress.documentflow.signing;

import kz.ecoprogress.documentflow.signing.dto.SigningRouteDtos;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class SigningResponseMapper {

    public SigningRouteDtos.SigningRouteResponse toResponse(SigningRoute route, SigningRouteService routeService) {
        List<SigningStep> steps = routeService.stepsOf(route.getId());
        List<Long> stepIds = steps.stream().map(SigningStep::getId).toList();
        var assignmentsByStep = routeService.assignmentsOf(stepIds).stream()
                .collect(java.util.stream.Collectors.groupingBy(SigningAssignment::getStepId));

        List<SigningRouteDtos.StepResponse> stepResponses = steps.stream()
                .map(step -> new SigningRouteDtos.StepResponse(
                        step.getId(), step.getStepOrder(), step.getRequiredCount(),
                        assignmentsByStep.getOrDefault(step.getId(), List.of()).stream()
                                .map(this::toResponse).toList()))
                .toList();

        return new SigningRouteDtos.SigningRouteResponse(
                route.getId(), route.getDocumentId(), route.getRouteType().name(), route.getStatus().name(),
                route.getCreatedBy(), route.getCreatedAt(), route.getActivatedAt(), route.getCompletedAt(),
                route.getVersion(), stepResponses);
    }

    public SigningRouteDtos.AssignmentResponse toResponse(SigningAssignment a) {
        return new SigningRouteDtos.AssignmentResponse(
                a.getId(), a.getStepId(), a.getSignerType().name(), a.getUserId(), a.getSignerFullName(),
                a.getOrganizationName(), a.getOrganizationBin(), a.getEmail(), a.getPhone(), a.getRoleCode(),
                a.isRequired(), a.getStatus().name(), a.getAvailableAt(), a.getViewedAt(), a.getSignedAt(),
                a.getRejectedAt(), a.getRejectionReason(), a.getInvitationExpiresAt());
    }

    public SigningRouteDtos.SignatureResponse toResponse(DocumentFlowSignature s) {
        return new SigningRouteDtos.SignatureResponse(
                s.getId(), s.getDocumentId(), s.getDocumentVersionId(), s.getRouteId(), s.getAssignmentId(),
                s.getSignerUserId(), s.getCertificateSerialNumber(), s.getCertificateSubject(), s.getCertificateIssuer(),
                s.getCertificateBin(), String.valueOf(s.getCertificateValidFrom()), String.valueOf(s.getCertificateValidTo()),
                s.getSignedAt(), s.getVerificationStatus().name());
    }
}
