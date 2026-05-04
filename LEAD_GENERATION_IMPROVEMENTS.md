# Lead Generation Improvements

## Что изменено

- Главная страница перестроена как lead-generation landing: hero, WhatsApp CTA, быстрая заявка без регистрации, преимущества, подбор услуги, услуги, этапы работы, доверие, документы, кейсы и лид-магнит.
- Добавлена короткая форма лида с сохранением в localStorage через отдельный service.
- Добавлен WhatsApp CTA в hero, footer, контакты, услуги и floating-кнопку.
- Добавлены отдельные SEO-страницы ключевых услуг.
- Добавлена структура для аналитики событий.
- Публичная навигация стала клиентской: Главная, Услуги, Как это работает, Документы, Кейсы, Контакты.
- Контакты обновлены как продающая страница с формой консультации.
- Кабинет клиента сохранен и дополнен понятной логикой статусов ранее внесенными улучшениями.

## Какие страницы добавлены

- `/services/ecological-documents`
- `/services/waste-transportation`
- `/services/waste-recycling`
- `/services/laboratory-tests`
- `/services/poligon-tbo`
- `/services/environmental-audit`
- `404` страница через `NotFoundPage`

## Какие компоненты добавлены

- `src/components/LeadForm.tsx`
- `src/components/ServiceSelector.tsx`
- `src/components/CaseStudies.tsx`
- `src/components/TrustBlocks.tsx`
- `src/components/SEO.tsx`
- `src/components/WhatsAppButton.tsx`

## Как проверить заявку

1. Открыть главную страницу.
2. Заполнить форму “Быстрая заявка без регистрации”.
3. После отправки увидеть success-сообщение.
4. Проверить localStorage ключ `eco-progress-leads`.
5. Можно также вызвать `getLeads()` из `src/services/leadService.ts` в будущей CRM-интеграции.

## Как подключить аналитику позже

- В `src/services/analytics.ts` уже есть методы `trackEvent`, `trackLeadSubmit`, `trackWhatsAppClick`, `trackServiceView`, `trackPhoneClick`.
- Сейчас события отправляются в `window.dataLayer`, если он есть, и логируются в консоль.
- Для Google Analytics, Meta Pixel или Яндекс Метрики достаточно заменить реализацию `trackEvent` или добавить адаптеры внутри него.
- Реальные ключи аналитики в проект не добавлялись.

## Что нужно сделать после подключения backend

- Отправлять лиды из `LeadForm` на backend вместо localStorage.
- Добавить статусы лидов в CRM сотрудника.
- Подключить уведомления менеджерам.
- Подключить реальные договоры, счета, документы, оплату и подпись.
- Заменить placeholder контактов, адреса, карты и юридической информации на реальные данные.
- Добавить реальные документы, сертификаты и разрешения в отдельный раздел.

## Что нужно сделать для SEO после покупки домена

- Заменить `https://ecoprogress.kz` в `src/config/company.ts`, `public/robots.txt` и `public/sitemap.xml`, если домен будет другим.
- Уточнить title/description по фактическим регионам и услугам.
- Добавить реальные Open Graph изображения.
- Добавить подтверждение сайта в Google Search Console и Яндекс Вебмастер.
- Настроить сервер так, чтобы `sitemap.xml` и `robots.txt` отдавались по корню домена.
