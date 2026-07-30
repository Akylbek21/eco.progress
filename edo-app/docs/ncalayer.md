# NCALayer

Production использует `WebSocketNcaLayerClient` и `VITE_NCALAYER_WS_URL`.

NCALayer подключается только после явного нажатия «Подписать». Закрытый ключ и пароль не покидают NCALayer. CMS и signing bytes хранятся только во временном memory state и очищаются:

- после ответа backend;
- при ошибке;
- при logout;
- при смене организации;
- при session revocation.

Test implementation разрешается только в Playwright/test source и не включается в production entry.
