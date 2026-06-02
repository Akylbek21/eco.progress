import { company } from '../config/company';

const twoGisWidgetSrcDoc = `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      html,
      body {
        margin: 0;
        min-height: 100%;
        overflow: hidden;
        background: #f1f5f9;
      }

      .dg-widget-link {
        display: none;
      }
    </style>
  </head>
  <body>
    <a class="dg-widget-link" href="https://2gis.kz/shymkent/firm/70000001113587757/center/69.637832,42.319356/zoom/16?utm_medium=widget-source&utm_campaign=firmsonmap&utm_source=bigMap">Посмотреть на карте Шымкента</a>
    <div class="dg-widget-link">
      <a href="https://2gis.kz/shymkent/center/69.637832,42.319356/zoom/16/routeTab/rsType/bus/to/69.637832,42.319356%E2%95%8EEco%20Progress,%20%D0%BA%D0%BE%D0%BC%D0%BF%D0%B0%D0%BD%D0%B8%D1%8F?utm_medium=widget-source&utm_campaign=firmsonmap&utm_source=route">Найти проезд до Eco Progress, компания</a>
    </div>
    <script charset="utf-8" src="https://widgets.2gis.com/js/DGWidgetLoader.js"><\/script>
    <script charset="utf-8">new DGWidgetLoader({"width":"100%","height":600,"borderColor":"#a3a3a3","pos":{"lat":42.319356,"lon":69.637832,"zoom":16},"opt":{"city":"shymkent"},"org":[{"id":"70000001113587757"}]});<\/script>
    <noscript style="color:#c00;font-size:16px;font-weight:bold;">Виджет карты использует JavaScript. Включите его в настройках вашего браузера.</noscript>
  </body>
</html>`;

const TwoGisMap = () => (
  <div className="overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-sm">
    <iframe
      title="Карта 2GIS Eco Progress"
      srcDoc={twoGisWidgetSrcDoc}
      className="block h-[420px] w-full border-0 sm:h-[600px]"
      loading="lazy"
      sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
    />
    <div className="flex flex-col gap-3 border-t border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-bold text-eco-900">Eco Progress, компания</p>
        <p className="mt-1 text-sm text-slate-600">{company.address}</p>
      </div>
      <a
        href={company.mapsUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center justify-center rounded-xl bg-eco-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-eco-800"
      >
        Открыть в 2GIS
      </a>
    </div>
  </div>
);

export default TwoGisMap;
