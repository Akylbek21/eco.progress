-- MPC_work_zone_air_general_reference / OEL_work_zone_air_general_reference have no real
-- pollutant code column. Older imports (before the parser fix) mistakenly copied the
-- aggregate-state marker ("a"/"а"/"п"/"п+а") into pollutant_code, which then caused unrelated
-- substances to collide on the dedup key and overwrite each other. Deactivate those bad rows;
-- a corrected re-import (NormativeResourceSeeder / import-resources endpoint) repopulates them
-- with pollutant_code = NULL.
UPDATE normative_records
SET active = false
WHERE source_document_code = 'DSM_70'
  AND LOWER(TRIM(COALESCE(pollutant_code, ''))) IN ('a', 'а', 'п', 'п+а', 'п+a');
