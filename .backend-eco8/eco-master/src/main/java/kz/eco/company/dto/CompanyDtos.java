package kz.eco.company.dto;

import kz.eco.company.CompanyStatus;
import jakarta.validation.constraints.Email;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public final class CompanyDtos {

    private CompanyDtos() {
    }

    /** Mutation-response shape (create/update/archive/restore) - unchanged since the previous
     *  audit pass, so existing consumers of those endpoints see no shape change. */
    public record CompanyDto(
            Long id,
            String name,
            String bin,
            String legalAddress,
            String actualAddress,
            String phone,
            String email,
            String comment,
            String notes,
            /** directorName internally - renamed on output to match the spec's response contract. */
            String directorFullName,
            String directorPosition,
            /** responsiblePerson internally - renamed on output to match the spec's response contract. */
            String contactPerson,
            /** responsiblePersonPhone internally - renamed on output to match the spec's response contract. */
            String contactPhone,
            String bankName,
            String iban,
            String bik,
            String kbe,
            String knp,
            String contractNumber,
            LocalDate contractDate,
            String objectName,
            String objectAddress,
            String activityType,
            String samplingLocation,
            String customerRepresentative,
            CompanyStatus status,
            int objectCount,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {
    }

    /** Lean row for GET /api/companies (paginated list) - matches the spec's list contract
     *  exactly, deliberately NOT the full requisite set (that's the card endpoint's job). */
    public record CompanyListItemDto(
            Long id,
            String name,
            String bin,
            String phone,
            String email,
            String address,
            boolean archived,
            int objectsCount,
            int activeObjectsCount,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {
    }

    /** GET /api/companies/{id} - full requisites plus objects/statistics/permissions in one
     *  request, per the spec's card contract. */
    public record CompanyCardDto(
            Long id,
            String name,
            String bin,
            String legalAddress,
            String actualAddress,
            String phone,
            String email,
            String comment,
            String notes,
            String directorFullName,
            String directorPosition,
            String contactPerson,
            String contactPhone,
            String bankName,
            String iban,
            String bik,
            String kbe,
            String knp,
            String contractNumber,
            LocalDate contractDate,
            String objectName,
            String objectAddress,
            String activityType,
            String samplingLocation,
            String customerRepresentative,
            CompanyStatus status,
            boolean archived,
            List<CompanyObjectDto> objects,
            CompanyStatisticsDto statistics,
            CompanyPermissionsDto permissions,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {
    }

    public record CompanyStatisticsDto(
            long protocolsCount,
            int activeObjectsCount,
            int archivedObjectsCount,
            String lastProtocolDate
    ) {
    }

    /** Backend still enforces every operation independently via @PreAuthorize - this is a
     *  convenience for the frontend, not the actual access-control boundary. */
    public record CompanyPermissionsDto(
            boolean canEdit,
            boolean canArchive,
            boolean canCreateObject
    ) {
    }

    public record CreateCompanyRequest(
            String name,
            String bin,
            String legalAddress,
            String actualAddress,
            String phone,
            @Email(message = "Некорректный email") String email,
            String comment,
            String notes,
            String directorName,
            String directorPosition,
            String responsiblePerson,
            String responsiblePersonPhone,
            String bankName,
            String iban,
            String bik,
            String kbe,
            String knp,
            String contractNumber,
            LocalDate contractDate,
            String objectName,
            String objectAddress,
            String activityType,
            String samplingLocation,
            String customerRepresentative
    ) {
    }

    public record UpdateCompanyRequest(
            String name,
            String bin,
            String legalAddress,
            String actualAddress,
            String phone,
            @Email(message = "Некорректный email") String email,
            String comment,
            String notes,
            String directorName,
            String directorPosition,
            String responsiblePerson,
            String responsiblePersonPhone,
            String bankName,
            String iban,
            String bik,
            String kbe,
            String knp,
            String contractNumber,
            LocalDate contractDate,
            String objectName,
            String objectAddress,
            String activityType,
            String samplingLocation,
            String customerRepresentative
    ) {
    }

    public record CompanySearchDto(
            Long id,
            String name,
            String bin,
            String legalAddress,
            String actualAddress,
            String phone,
            String email,
            String objectName,
            CompanyStatus status
    ) {
    }

    public record CompanyObjectDto(
            Long id,
            Long companyId,
            String name,
            String address,
            String activityType,
            String samplingLocation,
            String coordinates,
            String sanitaryZone,
            String notes,
            CompanyStatus status,
            boolean primary
    ) {
    }

    public record CompanyObjectPayload(
            String name,
            String address,
            String activityType,
            String samplingLocation,
            String coordinates,
            String sanitaryZone,
            String notes
    ) {
    }
}
