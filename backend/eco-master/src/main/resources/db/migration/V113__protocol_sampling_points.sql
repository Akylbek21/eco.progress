-- Sampling points for AMBIENT_AIR_SZZ and any protocol type that tracks multiple named
-- collection locations. Each row is one point of probe collection (e.g. North/South/East/West
-- boundary of an industrial site, or any arbitrary named location). Results can be linked here
-- via sampling_point_id; for AMBIENT_AIR_SZZ the link is mandatory (enforced at service layer),
-- for all other types it is optional so legacy data and non-SZZ protocols are unaffected.
CREATE TABLE IF NOT EXISTS protocol_sampling_points (
    id          BIGINT NOT NULL AUTO_INCREMENT,
    protocol_id BIGINT       NOT NULL,
    name        VARCHAR(200) NOT NULL,
    description VARCHAR(600),
    latitude    NUMERIC(10, 6),
    longitude   NUMERIC(10, 6),
    sort_order  INTEGER      NOT NULL DEFAULT 0,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version     BIGINT       NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    CONSTRAINT fk_protocol_sampling_point_protocol
        FOREIGN KEY (protocol_id) REFERENCES lab_protocols(id) ON DELETE CASCADE
);

CREATE INDEX idx_sampling_points_protocol_id
    ON protocol_sampling_points (protocol_id, sort_order);

-- Nullable FK: legacy rows stay NULL; new AMBIENT_AIR_SZZ rows must set a value (enforced at
-- the service layer, not by a DB constraint, so old protocols are never broken by a migration).
ALTER TABLE protocol_results
    ADD COLUMN IF NOT EXISTS sampling_point_id BIGINT NULL;

ALTER TABLE protocol_results
    ADD CONSTRAINT fk_protocol_result_sampling_point
        FOREIGN KEY (sampling_point_id) REFERENCES protocol_sampling_points(id) ON DELETE SET NULL;

CREATE INDEX idx_protocol_results_sampling_point ON protocol_results (sampling_point_id);

-- Safe legacy backfill: one normalized point per distinct non-empty sampling_place. Rows without
-- any historical place text remain NULL and continue to be readable/editable until the operator
-- explicitly enables the normalized model by adding a point.
INSERT INTO protocol_sampling_points
    (protocol_id, name, sort_order, created_at, updated_at, version)
SELECT r.protocol_id, TRIM(r.sampling_place), 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0
FROM protocol_results r
JOIN lab_protocols p ON p.id = r.protocol_id
WHERE UPPER(p.template_code) = 'AMBIENT_AIR_SZZ'
  AND r.sampling_place IS NOT NULL AND TRIM(r.sampling_place) <> ''
GROUP BY r.protocol_id, TRIM(r.sampling_place);

UPDATE protocol_results r
JOIN protocol_sampling_points sp
  ON sp.protocol_id = r.protocol_id AND sp.name = TRIM(r.sampling_place)
SET r.sampling_point_id = sp.id
WHERE r.sampling_point_id IS NULL;
