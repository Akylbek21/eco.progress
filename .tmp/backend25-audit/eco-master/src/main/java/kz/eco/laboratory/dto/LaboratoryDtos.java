package kz.eco.laboratory.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

public final class LaboratoryDtos {

    private LaboratoryDtos() {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record LaboratoryResponse(
            Long id,
            String name,
            String legalName,
            String bin,
            String address,
            String phone,
            String email,
            String accreditationNumber,
            String accreditationIssuedAt,
            String accreditationValidUntil,
            Long directorId,
            String directorName,
            Long laboratoryHeadId,
            String laboratoryHeadName,
            String logoUrl,
            String standardNote,
            boolean isDefault,
            boolean active
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record LaboratoryEmployeeResponse(
            Long id,
            Long laboratoryId,
            Long userId,
            String fullName,
            String position,
            String email,
            String role,
            boolean active,
            String phone,
            String employeeNumber,
            String qualification,
            boolean canExecuteMeasurements,
            boolean canApproveProtocols,
            boolean canSignProtocols,
            String deactivatedAt,
            Long version
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record CreateLaboratoryRequest(
            String name,
            String legalName,
            String bin,
            String address,
            String phone,
            String email,
            String accreditationNumber,
            String accreditationIssuedAt,
            String accreditationValidUntil,
            Long directorId,
            String directorName,
            Long laboratoryHeadId,
            String laboratoryHeadName,
            String logoUrl,
            String standardNote,
            Boolean isDefault,
            Boolean active
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record UpdateLaboratoryRequest(
            String name,
            String legalName,
            String bin,
            String address,
            String phone,
            String email,
            String accreditationNumber,
            String accreditationIssuedAt,
            String accreditationValidUntil,
            Long directorId,
            String directorName,
            Long laboratoryHeadId,
            String laboratoryHeadName,
            String logoUrl,
            String standardNote,
            Boolean isDefault,
            Boolean active
    ) {
    }

    /** ignoreUnknown = false deliberately: a typo'd field name in a critical mutation like this
     *  must surface as a 400, not be silently dropped (this is the entire reason capability flags
     *  like canSignProtocols went missing before - the record simply had no component for them,
     *  and the previous ignoreUnknown=true would have masked that same class of bug forever). */
    @JsonIgnoreProperties(ignoreUnknown = false)
    public record CreateEmployeeRequest(
            Long userId,
            String fullName,
            String position,
            String email,
            String role,
            Boolean active,
            String phone,
            String employeeNumber,
            String qualification,
            Boolean canExecuteMeasurements,
            Boolean canApproveProtocols,
            Boolean canSignProtocols
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = false)
    public record UpdateEmployeeRequest(
            Long userId,
            String fullName,
            String position,
            String email,
            String role,
            Boolean active,
            String phone,
            String employeeNumber,
            String qualification,
            Boolean canExecuteMeasurements,
            Boolean canApproveProtocols,
            Boolean canSignProtocols,
            Long version
    ) {
    }

    /** A system user (ADMIN/DIRECTOR/HEAD/LABORATORY) eligible to be linked as a laboratory
     *  employee - not yet a LaboratoryEmployee row, so id == userId here. */
    public record EligibleEmployeeResponse(
            Long id,
            Long userId,
            String fullName,
            String position,
            String email,
            String role,
            boolean active
    ) {
    }
}
