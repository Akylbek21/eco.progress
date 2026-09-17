-- Починка V117: расширение regulation_version до VARCHAR(500) там было записано как
--     ALTER TABLE t ALTER COLUMN regulation_version VARCHAR(500) NOT NULL;
-- Это валидный синтаксис H2 (локальная разработка идёт на H2, MODE=PostgreSQL), но в MySQL смена
-- типа колонки делается только через MODIFY COLUMN - остальной репозиторий так и пишет (V12, V108).
-- Поэтому дефект не виден локально и проявляется только на MySQL (docker/prod).
--
-- Цена ошибки: колонки остаются VARCHAR(120) из V104/V105, а приложение пишет туда цитату
-- действующей редакции, собранную в PekRegulationVersion#citation() из base_order + revision_order
-- (V125). Для редакции 2026 года это 272 символа. MySQL отвечает Data truncation, Spring переводит
-- это в DataIntegrityViolationException, и GlobalExceptionHandler отдаёт 409 REFERENCE_CONFLICT -
-- последний fallback, который сообщает «Одна из связанных записей не существует». Сообщение
-- вводит в заблуждение: у pek_report_document_versions нет ни одного внешнего ключа, ломается
-- именно длина колонки. Наружу это выглядит как отказ сформировать любой документ ПЭК - комплект,
-- официальный и внутренний отчёт падают одинаково, потому что все они заканчиваются одной и той же
-- вставкой в pek_report_document_versions (PekReportDocumentGenerationService).
--
-- Миграция идемпотентна: там, где V117 отработала (H2), MODIFY COLUMN просто переобъявляет колонку
-- в том же виде. DEFAULT переуказывается явно - MODIFY COLUMN сбрасывает значение по умолчанию,
-- если его не повторить в новом определении.
--
-- Запас 500 взят из V125: base_order и revision_order справочника - по VARCHAR(500) каждый, так что
-- администратор в принципе может собрать цитату длиннее. Это осознанно не закрывается здесь:
-- валидация длины citation() - задача уровня приложения, а не ширины колонки.

ALTER TABLE pek_programs
    MODIFY COLUMN regulation_version VARCHAR(500) NOT NULL
        DEFAULT 'Правила №250 (Приказ МЭГПР РК от 14.07.2021 №250, рег. №23553)';

ALTER TABLE pek_reports
    MODIFY COLUMN regulation_version VARCHAR(500) NOT NULL
        DEFAULT 'Правила №250 (Приказ МЭГПР РК от 14.07.2021 №250, рег. №23553)';

-- Данные в этой таблице по-прежнему НЕ переписываются (см. хвост V117): regulation_version здесь -
-- штамп того, что фактически напечатано в уже сформированном и, возможно, подписанном файле.
-- Меняется только тип колонки.
ALTER TABLE pek_report_document_versions
    MODIFY COLUMN regulation_version VARCHAR(500) NOT NULL
        DEFAULT 'Правила №250 (Приказ МЭГПР РК от 14.07.2021 №250, рег. №23553)';
