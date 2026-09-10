# Document Flow status machine

| From | Allowed targets |
|---|---|
| DRAFT | PREPARED_FOR_SIGNING, READY_FOR_SIGNING (legacy), CANCELLED, ARCHIVED |
| PREPARED_FOR_SIGNING | SENT_FOR_SIGNING, DRAFT, CANCELLED |
| SENT_FOR_SIGNING | PARTIALLY_SIGNED, SIGNED, REJECTED, RETURNED_FOR_REVISION, EXPIRED, CANCELLED |
| PARTIALLY_SIGNED | SIGNED, REJECTED, RETURNED_FOR_REVISION, EXPIRED, CANCELLED |
| SIGNED | REVOCATION_REQUESTED, ARCHIVED |
| REVOKED/CANCELLED/EXPIRED | ARCHIVED (EXPIRED также DRAFT) |
| ARCHIVED | — |

Прямая отправка `DRAFT -> SENT_FOR_SIGNING` запрещена. Prepare требует файл, маршрут, подписантов, доступ, лимит и актуальную версию; затем блокирует current version. Send повторно проверяет version и prepared status.

