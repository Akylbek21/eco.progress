package kz.eco.pek;

/**
 * Official (state-facing) report dataset a {@link PekReportResultRow} belongs to. This is the
 * structural axis {@code GET /api/pek/reports/{id}/official-data} and
 * {@code OfficialPekReportDocxRenderer} group rows by - one table per applicable type, never an
 * empty table for a type the program/object does not declare (see
 * {@link PekOfficialReportDataService#applicability}).
 */
public enum PekOfficialTableType {
    /** Instrumental/calculated emissions to atmospheric air from a stationary source (г/с, т/год). */
    EMISSIONS,
    /** General instrumental measurements not covered by a more specific table (e.g. physical
     *  factors other than radiation: noise, vibration, illumination). */
    INSTRUMENTAL_MEASUREMENTS,
    /** Emissions obtained by calculation rather than direct instrumental measurement
     *  (ProtocolResult.calculationStatus = CALCULATED). */
    CALCULATED_EMISSIONS,
    /** Ambient (outdoor) air quality at a monitoring point - PDK-based, not source-based. */
    AMBIENT_AIR,
    WASTEWATER,
    /** Surface/ground water bodies (as opposed to a wastewater outlet). */
    WATER,
    SOIL,
    /** Physical factor results identified as radiological (dose rate / gamma background /
     *  radionuclide content) by indicator name or code. */
    RADIATION,
    /** Water monitoring for a facility flagged {@link kz.eco.company.SpecialMonitoringType#CASPIAN_MARINE} -
     *  supersedes {@link #WATER}/{@link #WASTEWATER} classification for such an object. */
    MARINE
}
