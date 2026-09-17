package kz.eco.pek;

import jakarta.persistence.*;

/** Join row for the program ↔ environmental-permit M:N association (item 10 / V109).
 *  One permit may be linked to multiple programs; one program may reference multiple permits. */
@Entity
@Table(name = "pek_program_permits")
@IdClass(PekProgramPermitLink.PK.class)
public class PekProgramPermitLink {

    @Id
    @Column(name = "program_id", nullable = false)
    private Long programId;

    @Id
    @Column(name = "permit_id", nullable = false)
    private Long permitId;

    public PekProgramPermitLink() {}

    public PekProgramPermitLink(Long programId, Long permitId) {
        this.programId = programId;
        this.permitId = permitId;
    }

    public Long getProgramId() { return programId; }
    public Long getPermitId() { return permitId; }

    public static class PK implements java.io.Serializable {
        private Long programId;
        private Long permitId;
        public PK() {}
        public PK(Long programId, Long permitId) { this.programId = programId; this.permitId = permitId; }
        @Override public boolean equals(Object o) {
            if (!(o instanceof PK pk)) return false;
            return java.util.Objects.equals(programId, pk.programId) && java.util.Objects.equals(permitId, pk.permitId);
        }
        @Override public int hashCode() { return java.util.Objects.hash(programId, permitId); }
    }
}
