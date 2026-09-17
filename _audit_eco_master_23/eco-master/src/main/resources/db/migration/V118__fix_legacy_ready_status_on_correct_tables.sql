-- V97 уже пыталось убрать легаси-статус READY, но обращалось к таблице `protocols`, тогда как
-- сущность kz.eco.protocol.Protocol маппится на `lab_protocols` (@Table(name = "lab_protocols")).
-- Таблицы `protocols` в схеме нет, поэтому данные так и остались непереведёнными: боевая база
-- по-прежнему содержит lab_protocols.status = 'READY'. Побочный эффект того же промаха -
-- protocol_audit_logs V97 не трогало вообще, хотя old_status/new_status хранят те же константы.
--
-- Пока Hibernate работал в режиме ddl-auto=update, он на каждом старте пытался сконвертировать
-- эти VARCHAR-колонки в нативный MySQL ENUM(...) со списком актуальных констант и падал с
-- "Data truncated for column 'status'" именно на строках со значением READY. Конвертацию убрали
-- (hibernate.type.preferred_enum_jdbc_type=VARCHAR), но сами значения остаются нечитаемыми для
-- приложения: ProtocolStatus.valueOf("READY") бросит IllegalArgumentException при чтении такой
-- строки. Поэтому данные нужно привести к текущему набору констант.
--
-- READY_FOR_APPROVAL - тот же выбор соответствия, что был обоснован в V97: READY означал
-- "подготовлен и ожидает шага подписания/утверждения", что и есть READY_FOR_APPROVAL.
UPDATE lab_protocols SET status = 'READY_FOR_APPROVAL' WHERE status = 'READY';

-- Аудит-лог переписывается сознательно: строки с READY сейчас нечитаемы приложением, а сам
-- переход при этом не искажается - READY и READY_FOR_APPROVAL обозначают одно состояние под
-- разными именами.
UPDATE protocol_audit_logs SET old_status = 'READY_FOR_APPROVAL' WHERE old_status = 'READY';
UPDATE protocol_audit_logs SET new_status = 'READY_FOR_APPROVAL' WHERE new_status = 'READY';
