# ECOPROGRESS GROUP frontend

Фронтенд онлайн-сервиса ECOPROGRESS GROUP для экологической компании. Backend пока не подключен: данные берутся из mock data и localStorage.

## Реализовано

- Публичный сайт: `/`, `/about`, `/services`, `/services/:id`, `/employees`, `/news`, `/news/:id`, `/faq`, `/contacts`.
- Регистрация клиента: физическое лицо или юридическое лицо / ИП на `/register`.
- Вход клиента на `/login`.
- Кабинет клиента: `/cabinet`, заявки, новая заявка, документы, оплаты, профиль/данные компании, уведомления.
- Вход сотрудника: `/staff/login`.
- Кабинет сотрудника / mini-CRM: dashboard, таблица заявок, карточка заявки, клиенты, документы, уведомления, профиль.
- Админка управления контентом: `/admin`.

## Запуск

```bash
npm install
npm run dev
npm run build
```

## Mock-логины

- Клиент: любые email и пароль на `/login`.
- Сотрудник: `manager@ecoprogress.kz`, пароль любой на `/staff/login`.

## Mock data и localStorage

Исходные данные находятся в `src/data/mockData.ts`: услуги, новости, сотрудники, пользователи, клиенты, заявки, документы, оплаты, уведомления, комментарии и история заявок.

Сервисы в `src/services` имитируют API:

- `login()`, `staffLogin()`, `register()`, `logout()`
- `getServices()`, `getServiceById()`
- `getNews()`, `getNewsById()`
- `getOrders()`, `getOrderById()`, `createOrder()`
- `updateOrderStatus()`, `addComment()`, `uploadDocument()`

Клиент создает заявку в кабинете, сотрудник видит ее в CRM, меняет статус, добавляет комментарии и загружает mock-документы. Изменения сохраняются в localStorage и видны в кабинете клиента.
