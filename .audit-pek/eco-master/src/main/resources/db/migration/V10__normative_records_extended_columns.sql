ALTER TABLE normative_records
    ADD COLUMN limiting_indicator VARCHAR(100);

ALTER TABLE normative_records
    ADD COLUMN testing_method VARCHAR(300);

ALTER TABLE normative_records
    ADD COLUMN sampling_method VARCHAR(300);
