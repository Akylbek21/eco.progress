const SVG_NS = 'http://www.w3.org/2000/svg';
const mapHost = document.getElementById('map');
const status = document.getElementById('map-status');

function createSvgElement(name, attributes = {}) {
  const element = document.createElementNS(SVG_NS, name);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
  return element;
}

async function renderMap() {
  const response = await fetch('./data/kazakhstan-regions.json');
  if (!response.ok) throw new Error('Regional boundaries unavailable');

  const regions = await response.json();
  const svg = createSvgElement('svg', {
    class: 'kazakhstan-map',
    viewBox: '7 7 586 326',
    role: 'img',
    'aria-label': 'Карта Казахстана. Границы областей показаны тонкими линиями.',
    preserveAspectRatio: 'xMidYMid meet',
  });

  const defs = createSvgElement('defs');
  const filter = createSvgElement('filter', {
    id: 'outer-outline',
    x: '-3%',
    y: '-6%',
    width: '106%',
    height: '112%',
    'color-interpolation-filters': 'sRGB',
  });
  filter.append(
    createSvgElement('feMorphology', { in: 'SourceAlpha', operator: 'dilate', radius: '.85', result: 'expanded' }),
    createSvgElement('feFlood', { 'flood-color': '#1F2933', result: 'border-color' }),
    createSvgElement('feComposite', { in: 'border-color', in2: 'expanded', operator: 'in', result: 'border' }),
  );
  const merge = createSvgElement('feMerge');
  merge.append(createSvgElement('feMergeNode', { in: 'border' }));
  filter.append(merge);
  defs.append(filter);
  svg.append(defs);

  const outline = createSvgElement('g', { class: 'map-outline', 'aria-hidden': 'true' });
  regions.forEach((region) => outline.append(createSvgElement('path', { d: region.path })));
  svg.append(outline);

  const regionLayer = createSvgElement('g');
  regions.forEach((region) => {
    regionLayer.append(createSvgElement('path', {
      class: 'region',
      d: region.path,
      tabindex: '0',
      role: 'img',
      'aria-label': region.name_en,
      'data-region': region.pcode,
    }));
  });
  svg.append(regionLayer);

  status.hidden = true;
  mapHost.append(svg);
}

renderMap().catch(() => {
  status.textContent = 'Карта временно недоступна.';
});
