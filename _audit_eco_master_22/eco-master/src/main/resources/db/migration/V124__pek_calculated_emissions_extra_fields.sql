ALTER TABLE pek_report_result_rows
    ADD COLUMN calculation_method VARCHAR(255),
    ADD COLUMN raw_material_name VARCHAR(255),
    ADD COLUMN raw_material_consumption_tons NUMERIC(20, 6),
    ADD COLUMN equipment_operating_hours INTEGER;
