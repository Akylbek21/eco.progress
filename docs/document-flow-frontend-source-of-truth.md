# Единственный frontend документооборота

Production-реализация находится в `src/features/document-flow` и подключается из `src/App.tsx` через `DocumentFlowRoutes`.

Каталог `edo-app` является отдельным, не подключённым к корневому Vite build приложением. Его маршруты, API client и DTO не импортируются production-кодом EcoProgress. Разработка документооборота ведётся только в `src/features/document-flow`; административная часть использует связанный `src/features/document-flow-admin` и общий Axios client.

Источник HTTP-контрактов: controllers и DTO backend `eco-master (18).zip`, прочитанные 06.08.2026. Старые DTO `memberId`, `/documents/{id}/send` и `/document-flow/signatures` не поддерживаются.
