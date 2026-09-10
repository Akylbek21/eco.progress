package kz.eco.pek;

/** The environmental medium/control discipline a {@link PekProgramControlItem} monitors - module
 *  spec §6.2's control_type. Mirrors the report section list (§7.2) closely enough to drive
 *  automatic section assignment during collection, but is deliberately its own enum since a
 *  control item is a plan-time concept while a report section is a document-structure concept. */
public enum PekControlType {
    EMISSION,
    AMBIENT_AIR,
    WATER_INTAKE,
    WASTEWATER,
    WASTE,
    SOIL,
    PHYSICAL_FACTOR,
    BIODIVERSITY
}
