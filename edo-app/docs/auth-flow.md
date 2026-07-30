# Authentication flow

- Access token хранится только в памяти модуля API client.
- Refresh token передаётся backend только как `HttpOnly Secure` cookie.
- Параллельные 401 используют одну refresh promise.
- Login/register/refresh не запускают рекурсивный refresh.
- Logout и session revocation отменяют queries, очищают cache, tenant state, access token и sensitive signing state.
- Redirect после login допускает только внутренний путь, начинающийся с одного `/`.

JWT, CMS и external signing token не сохраняются в Web Storage.
