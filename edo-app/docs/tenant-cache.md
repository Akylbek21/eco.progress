# Tenant cache

Tenant query keys имеют вид:

```text
['organization', organizationId, 'documents', ...]
['organization', organizationId, 'members', ...]
['organization', organizationId, 'counterparties', ...]
```

При смене организации приложение:

1. очищает sensitive signing state;
2. отменяет активные queries;
3. активирует tenant на backend;
4. удаляет предыдущие tenant queries;
5. сбрасывает экран на dashboard.

Backend остаётся источником авторизации и tenant isolation.
