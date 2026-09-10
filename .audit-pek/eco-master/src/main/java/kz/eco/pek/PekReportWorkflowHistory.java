package kz.eco.pek;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "pek_report_workflow_history", indexes =
        @Index(name = "idx_pek_report_history_report_time", columnList = "report_id,performed_at"))
public class PekReportWorkflowHistory {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(name="report_id", nullable=false) private Long reportId;
    @Enumerated(EnumType.STRING) @Column(name="from_status", length=30) private PekReportStatus fromStatus;
    @Enumerated(EnumType.STRING) @Column(name="to_status", length=30) private PekReportStatus toStatus;
    @Column(nullable=false, length=40) private String action;
    @Column(length=2000) private String comment;
    @Column(name="performed_by", nullable=false) private Long performedBy;
    @Column(name="performed_at", nullable=false) private LocalDateTime performedAt = LocalDateTime.now();
    @Column(name="version_before") private Long versionBefore;
    @Column(name="version_after") private Long versionAfter;
    public Long getId(){return id;} public Long getReportId(){return reportId;} public void setReportId(Long v){reportId=v;}
    public PekReportStatus getFromStatus(){return fromStatus;} public void setFromStatus(PekReportStatus v){fromStatus=v;}
    public PekReportStatus getToStatus(){return toStatus;} public void setToStatus(PekReportStatus v){toStatus=v;}
    public String getAction(){return action;} public void setAction(String v){action=v;} public String getComment(){return comment;}
    public void setComment(String v){comment=v;} public Long getPerformedBy(){return performedBy;} public void setPerformedBy(Long v){performedBy=v;}
    public LocalDateTime getPerformedAt(){return performedAt;} public Long getVersionBefore(){return versionBefore;}
    public void setVersionBefore(Long v){versionBefore=v;} public Long getVersionAfter(){return versionAfter;} public void setVersionAfter(Long v){versionAfter=v;}
}
