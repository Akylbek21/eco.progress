# Аудит `noindex,follow`

Дата среза: 2026-08-25. Источник истины: `src/data/seoRegistry.generated.json`.

После точечной проверки в реестре остаётся 183 страницы с `noindex,follow`:

- 167 service-city страниц без подтверждённой коммерческой проверки;
- 14 статей без подтверждённой проверки профильным специалистом;
- 1 специальный SES-лендинг без подтверждённой проверки;
- 1 страница команды.

Полный машинно-читаемый список с причиной для каждого URL выводится командой:

```text
npm run seo:noindex-report
```

## Service-city: 167 URL

Обозначим набор городских slug без уже проверенного Шымкента:

`almaty`, `astana`, `taraz`, `turkestan`, `kyzylorda`, `aktobe`, `atyrau`, `karaganda`, `pavlodar`, `ust-kamenogorsk`, `kostanay`, `aktau`, `petropavlovsk`, `oral`, `kokshetau`, `taldykorgan`, `semey`.

Для каждого из 17 slug выше остаются `noindex,follow`:

- `/szz-{city}`;
- `/pasport-othodov-{city}`;
- `/pek-{city}`;
- `/ekologicheskoe-razreshenie-{city}`;
- `/ovos-{city}`;
- `/ndv-{city}`;
- `/puo-{city}`.

Для тех же городов, кроме `almaty`, остаются `noindex,follow`:

- `/laboratornye-zamery-{city}`;
- `/otchet-pek-{city}`;
- `/roos-{city}`.

Эта матрица перечисляет все 167 URL: `7 × 17 + 3 × 16`.

## Статьи: 14 URL

- `/news/ekologicheskie-dokumenty-too-kazakhstan`
- `/news/chto-sdavat-po-ekologii-kazhdyy-god`
- `/news/kak-opredelit-kategoriyu-obekta`
- `/news/chto-takoe-proizvodstvennyy-ekologicheskiy-kontrol`
- `/news/kak-formiruetsya-otchet-pek`
- `/news/kakie-laboratornye-zamery-nuzhny-predpriyatiyu`
- `/news/kak-prohodit-laboratornyy-zamer-vozduha`
- `/news/podgotovka-k-ekologicheskoy-proverke`
- `/news/kak-razrabotat-programmu-upravleniya-othodami`
- `/news/dokumenty-peredachi-othodov`
- `/news/vyvoz-i-utilizaciya-othodov`
- `/news/kogda-nuzhen-proekt-ndv`
- `/news/otlichiya-ovos-oovv-roos`
- `/news/shtrafy-za-ekologicheskie-narusheniya`

## Остальные: 2 URL

- `/ses-proverka-proizvodstvennyy-kontrol` — ожидает проверки специалистом;
- `/employees` — страница команды намеренно не индексируется.

## Решения по URL с позициями в GSC

| URL | Решение | Проверка |
| --- | --- | --- |
| `/laboratornye-zamery-almaty` | `index,follow` | 645 слов, 8 секций, 6 FAQ, самостоятельные service/region блоки |
| `/roos-almaty` | `index,follow` | 647 слов, 8 секций, 6 FAQ, самостоятельные service/region блоки |
| `/otchet-pek-almaty` | `index,follow` | 651 слово, 8 секций, 6 FAQ, самостоятельные service/region блоки |
| `/news/kak-opredelit-kategoriyu-obekta` | оставить `noindex,follow` | 286 слов; нет reviewer и статуса `approved` в CMS |

Для трёх коммерческих страниц максимальное сходство с ближайшим другим service-city URL по 5-словным фрагментам составляет 43,1–47,6%. Массовая индексация остальных шаблонных комбинаций не выполнялась.
