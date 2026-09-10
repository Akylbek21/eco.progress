package kz.ecoprogress.documentflow.signing;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * One step of a signing route. {@code stepOrder} is meaningful for SEQUENTIAL/MIXED routes
 * (lower order signs first); for a pure PARALLEL route every step effectively has the same order
 * (0) and all its assignments become AVAILABLE immediately when the route activates.
 *
 * {@code requiredCount}: how many of this step's assignments must reach SIGNED before the route
 * can advance to the next step (or complete, if this is the last step). Design choice documented
 * here per the ticket's "your call": we require ALL assignments in a step (requiredCount ==
 * assignment count) rather than a partial quorum - simplest and safest default for a legal
 * document-signing flow where every named signer's approval is normally mandatory. Partial quorum
 * is still representable (requiredCount &lt; total assignments) for future use, and
 * SigningRouteProgressService honors whatever value is stored here.
 */
@Entity
@Table(name = "document_flow_signing_steps")
public class SigningStep {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "route_id", nullable = false)
    private Long routeId;

    @Column(name = "step_order", nullable = false)
    private int stepOrder;

    @Column(name = "required_count", nullable = false)
    private int requiredCount;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getRouteId() { return routeId; }
    public void setRouteId(Long routeId) { this.routeId = routeId; }
    public int getStepOrder() { return stepOrder; }
    public void setStepOrder(int stepOrder) { this.stepOrder = stepOrder; }
    public int getRequiredCount() { return requiredCount; }
    public void setRequiredCount(int requiredCount) { this.requiredCount = requiredCount; }
}
