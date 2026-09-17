package kz.eco.pek;

import java.time.LocalDate;

/**
 * One entry of the PEK regulation reference book (справочник нормативной базы).
 *
 * <p>Replaces the single hardcoded {@code String regulationVersion} that used to be stamped onto
 * programs and reports. A stamped program must be able to answer, years later, not just "which
 * regulation" but "which EDITION of it, and which document template that edition prescribes" -
 * an amended regulation does not retroactively change a program that was approved under the
 * previous edition.
 *
 * @param code                   stable identifier persisted on programs/reports; never reused
 * @param title                  human-readable name shown in UI and in the document header
 * @param baseOrder              citation of the order that originally approved the rules
 * @param revisionOrder          citation of the amending order, or {@code null} for a base edition
 * @param effectiveFrom          first day this edition applies
 * @param effectiveTo            last day this edition applies, or {@code null} while it is current
 * @param programTemplateVersion structural template version for the PEK program document
 * @param reportTemplateVersion  structural template version for the official PEK report document
 */
public record PekRegulationVersion(
        String code,
        String title,
        String baseOrder,
        String revisionOrder,
        LocalDate effectiveFrom,
        LocalDate effectiveTo,
        String programTemplateVersion,
        String reportTemplateVersion
) {

    public boolean isEffectiveOn(LocalDate date) {
        if (effectiveFrom != null && date.isBefore(effectiveFrom)) return false;
        return effectiveTo == null || !date.isAfter(effectiveTo);
    }

    /** Full citation as it must appear in the "Нормативная основа" header of generated documents. */
    public String citation() {
        return revisionOrder == null ? title + " (" + baseOrder + ")"
                : title + " (" + baseOrder + ", в редакции " + revisionOrder + ")";
    }
}
