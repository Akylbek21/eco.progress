create table if not exists lab_journal_entries (
    id bigserial primary key,
    journal_type varchar(100) not null,
    row_number integer,
    entry_date date,
    data jsonb not null,
    laboratory_id bigint,
    created_by bigint,
    updated_by bigint,
    created_at timestamp not null default localtimestamp,
    updated_at timestamp not null default localtimestamp,
    deleted boolean not null default false
);

create index if not exists idx_lab_journal_type
on lab_journal_entries (journal_type);

create index if not exists idx_lab_journal_entry_date
on lab_journal_entries (entry_date);

create index if not exists idx_lab_journal_laboratory
on lab_journal_entries (laboratory_id);

create index if not exists idx_lab_journal_data_gin
on lab_journal_entries using gin (data);
