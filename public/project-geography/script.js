// ADD CITIES HERE
// CHANGE PROJECT DATA HERE — illustrative counts supplied for the section; replace with verified company data.
export const cities = [
  { name: 'Астана', lat: 51.1694, lng: 71.4491, projectCount: 6, status: 'Работаем', description: 'Экологическое проектирование и сопровождение предприятий в Астане.', image: '/ekologicheskoe-soprovozhdenie.jpg' },
  { name: 'Алматы', lat: 43.238949, lng: 76.889709, projectCount: 8, status: 'Работаем', description: 'Проекты компании в Алматы. Исследования, проектирование и экологический контроль.', image: '/edward.jpg' },
  { name: 'Шымкент', lat: 42.3417, lng: 69.5901, projectCount: 4, status: 'Работаем', description: 'Лабораторные исследования и экологическое сопровождение в Шымкенте.', image: '/media/otbor-prob-vody-1280.jpg' },
  { name: 'Атырау', lat: 47.0945, lng: 51.9238, projectCount: 2, status: 'Работаем', description: 'Экологическое сопровождение предприятий в Атырау.', image: '/ekologicheskoe-soprovozhdenie.jpg' },
  { name: 'Актау', lat: 43.6532, lng: 51.1975, projectCount: 2, status: 'Работаем', description: 'Проектирование и экологический контроль в Актау.', image: '/edward.jpg' },
  { name: 'Караганда', lat: 49.8047, lng: 73.1094, projectCount: 2, status: 'Работаем', description: 'Экологические проекты для предприятий Караганды.', image: '/ekologicheskoe-soprovozhdenie.jpg' },
  { name: 'Актобе', lat: 50.2839, lng: 57.167, projectCount: 2, status: 'Работаем', description: 'Экологическое сопровождение и исследования в Актобе.', image: '/edward.jpg' },
  { name: 'Павлодар', lat: 52.2873, lng: 76.9674, projectCount: 1, status: 'Работаем', description: 'Проектирование и производственный контроль в Павлодаре.', image: '/ekologicheskoe-soprovozhdenie.jpg' },
];
// CHANGE CONNECTIONS HERE — new cities automatically connect to the central node.
const connections = [['Астана','Алматы'],['Астана','Караганда'],['Астана','Павлодар'],['Алматы','Шымкент'],['Атырау','Актау'],['Астана','Актобе'],['Актобе','Атырау']];
const $ = (id) => document.getElementById(id);
const select = $('city-select');
let active = '', hovered = '', renderOnce = () => {}, lastTrigger;
function openCity(city, trigger) {
  active = city.name; lastTrigger = trigger; select.value = city.name;
  $('city-title').textContent = city.name;
  $('city-count').textContent = city.projectCount;
  $('city-status').textContent = city.status;
  $('city-description').textContent = city.description;
  $('city-image').hidden = false;
  $('city-image').src = city.image;
  $('city-image').alt = 'Проекты и направления работы Eco Progress';
  $('city-card').hidden = false;
  document.querySelectorAll('.city-label').forEach(b => { b.classList.toggle('active', b.dataset.city === active); b.setAttribute('aria-expanded', String(b.dataset.city === active)); });
  $('close-card').focus({ preventScroll: true }); renderOnce();
}
function closeCity() {
  active = ''; select.value = ''; $('city-card').hidden = true;
  document.querySelectorAll('.city-label').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-expanded', 'false'); });
  lastTrigger?.focus({ preventScroll: true }); renderOnce();
}
cities.forEach(city => { const option = new Option(city.name, city.name); select.add(option); });
select.addEventListener('change', () => { const city = cities.find(c => c.name === select.value); if (city) openCity(city, select); else closeCity(); });
$('close-card').addEventListener('click', closeCity);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('city-card').hidden) closeCity(); });
$('city-image').addEventListener('error', () => { $('city-image').hidden = true; });

async function init() {
  const [THREE, { OrbitControls }, response] = await Promise.all([import('three'), import('three/addons/controls/OrbitControls.js'), fetch('./data/kazakhstan.geojson')]);
  if (!response.ok) throw new Error('GeoJSON unavailable');
  const feature = await response.json();
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = matchMedia('(max-width: 700px)');
  const host = $('canvas-host');
  const scene = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile.matches ? 1.4 : 1.8));
  renderer.shadowMap.enabled = !mobile.matches;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.22;
  host.append(renderer.domElement);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  const root = new THREE.Group(); scene.add(root);
  // CHANGE MAP COLORS HERE — CSS variables are the single source of color values.
  const styles = getComputedStyle(document.documentElement);
  const color = key => styles.getPropertyValue(key).trim();
  const accent = color('--accent');
  const project = (lng, lat, height = 0) => new THREE.Vector3((lng - 66.5) * Math.cos(48 * Math.PI / 180), height, -(lat - 48));
  const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
  const shapes = polygons.map(polygon => {
    const rings = polygon.map(ring => ring.map(([lng, lat]) => { const p = project(lng, lat); return new THREE.Vector2(p.x, -p.z); }));
    const shape = new THREE.Shape(rings[0]); rings.slice(1).forEach(ring => shape.holes.push(new THREE.Path(ring))); return shape;
  });
  const surfaceHeight = .42;
  const geometry = new THREE.ExtrudeGeometry(shapes, { depth: surfaceHeight, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: .035, bevelThickness: .04, curveSegments: 1 });
  geometry.rotateX(-Math.PI / 2);
  const surfaceMaterial = new THREE.MeshStandardMaterial({ color: color('--map-color'), roughness: .48, metalness: .38 });
  // Fine etched texture follows the surface, with no geographic features or extra geometry.
  surfaceMaterial.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vSurfacePosition;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvSurfacePosition = position;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vSurfacePosition;').replace('#include <color_fragment>', `#include <color_fragment>
      float grain = fract(sin(dot(floor(vSurfacePosition.xz * 95.0), vec2(12.9898, 78.233))) * 43758.5453);
      float lightWash = smoothstep(-12.0, 12.0, -vSurfacePosition.x + vSurfacePosition.z * 0.4);
      diffuseColor.rgb *= 0.86 + 0.22 * lightWash + grain * 0.055;
    `);
  };
  const map = new THREE.Mesh(geometry, [surfaceMaterial, new THREE.MeshStandardMaterial({ color: '#102e2e', roughness: .4, metalness: .4 })]);
  map.castShadow = true; map.receiveShadow = true; root.add(map);
  const outlines = [];
  polygons.forEach(polygon => polygon.forEach(ring => {
    const g = new THREE.BufferGeometry().setFromPoints(ring.map(([lng, lat]) => project(lng, lat, surfaceHeight + .045)));
    const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: color('--border-color'), transparent: true, opacity: .8 }));
    root.add(line); outlines.push(line);
    const lower = new THREE.Line(g, new THREE.LineBasicMaterial({ color: '#67bca0', transparent: true, opacity: .23 }));
    lower.position.y = -surfaceHeight - .14; root.add(lower);
  }));
  scene.add(new THREE.HemisphereLight('#c6e9db', '#12322c', 1.65));
  const light = new THREE.DirectionalLight('#eef4d6', 3.1); light.position.set(-8, 18, -8); light.castShadow = !mobile.matches;
  Object.assign(light.shadow.camera, { left: -18, right: 18, top: 15, bottom: -15 }); light.shadow.mapSize.set(1024, 1024); light.shadow.bias = -.001; scene.add(light);
  const rimLight = new THREE.DirectionalLight('#73c6b5', 2); rimLight.position.set(8, 5, 4); scene.add(rimLight);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(70, 50), new THREE.ShadowMaterial({ opacity: .16 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -.9; ground.receiveShadow = true; scene.add(ground);
  // One shared, tiny radial texture replaces expensive bloom and particle systems.
  const glowCanvas = document.createElement('canvas'); glowCanvas.width = glowCanvas.height = 64;
  const glowContext = glowCanvas.getContext('2d');
  const gradient = glowContext.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(225,255,194,1)'); gradient.addColorStop(.12, 'rgba(199,235,164,.65)'); gradient.addColorStop(.4, 'rgba(129,204,158,.18)'); gradient.addColorStop(1, 'rgba(129,204,158,0)');
  glowContext.fillStyle = gradient; glowContext.fillRect(0, 0, 64, 64);
  const glowTexture = new THREE.CanvasTexture(glowCanvas);
  // CAMERA SETTINGS
  const camera = new THREE.PerspectiveCamera(36, 1, .1, 150);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false; controls.enableDamping = !motion.matches; controls.dampingFactor = .07;
  controls.minPolarAngle = .2; controls.maxPolarAngle = .76;
  controls.minAzimuthAngle = -.23; controls.maxAzimuthAngle = .23;
  controls.rotateSpeed = .35; controls.zoomSpeed = .45;
  // One-finger vertical gestures scroll the page. Two fingers adjust the map.
  function setDeviceControls() {
    controls.enableDamping = !motion.matches && !mobile.matches;
    controls.touches.ONE = mobile.matches ? null : THREE.TOUCH.ROTATE;
    renderer.domElement.style.touchAction = mobile.matches ? 'pan-y' : 'none';
    renderer.setPixelRatio(Math.min(devicePixelRatio, mobile.matches ? 1.4 : 1.8));
    renderer.shadowMap.enabled = !mobile.matches;
  }
  setDeviceControls();
  let distance = 32;
  function resetCamera() { const angle = mobile.matches ? .3 : .57; camera.position.set(0, distance * Math.cos(angle), distance * Math.sin(angle)); controls.target.set(0, 0, 0); controls.update(); }
  function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h);
    distance = Math.max(mobile.matches ? 25 : 25.5, 26 / (2 * Math.tan(Math.PI / 10) * camera.aspect)) * (mobile.matches ? 1.13 : 1);
    controls.minDistance = distance * .92; controls.maxDistance = distance * 1.22;
    resetCamera(); renderOnce();
  }
  const sphereGeometry = new THREE.SphereGeometry(.075, 12, 8);
  const ringGeometry = new THREE.RingGeometry(.16, .18, 24); ringGeometry.rotateX(-Math.PI / 2);
  const beamGeometry = new THREE.CylinderGeometry(.012, .035, .55, 6);
  const markers = cities.map(city => {
    const position = project(city.lng, city.lat, surfaceHeight + .1);
    const group = new THREE.Group(); group.position.copy(position);
    const sphere = new THREE.Mesh(sphereGeometry, new THREE.MeshBasicMaterial({ color: accent })); sphere.position.y = .08; group.add(sphere);
    const ring = new THREE.Mesh(ringGeometry, new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: .4, side: THREE.DoubleSide, depthWrite: false })); group.add(ring);
    const beam = new THREE.Mesh(beamGeometry, new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: mobile.matches ? .12 : .25, depthWrite: false })); beam.position.y = .26; group.add(beam);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, color: '#d6efab', transparent: true, opacity: .65, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.scale.setScalar(city.name === 'Астана' ? 1.05 : .72); halo.position.y = .09; group.add(halo);
    root.add(group);
    const label = document.createElement('button'); label.type = 'button'; label.className = 'city-label'; label.dataset.city = city.name; label.textContent = city.name;
    label.setAttribute('aria-controls', 'city-card'); label.setAttribute('aria-expanded', 'false');
    const tip = document.createElement('small'); tip.textContent = `${city.projectCount} проектов · ${city.status}`; label.append(tip); $('labels').append(label);
    label.addEventListener('click', () => openCity(city, label));
    for (const event of ['pointerenter','focus']) label.addEventListener(event, () => { hovered = city.name; renderOnce(); });
    for (const event of ['pointerleave','blur']) label.addEventListener(event, () => { hovered = ''; renderOnce(); });
    return { city, group, sphere, ring, halo, label, position };
  });
  const byName = new Map(markers.map(m => [m.city.name, m]));
  const linked = new Set(connections.flat());
  const allConnections = [...connections, ...cities.filter(c => c.name !== 'Астана' && !linked.has(c.name)).map(c => ['Астана', c.name])];
  const routes = allConnections.flatMap(([from, to]) => {
    if (!byName.has(from) || !byName.has(to)) return [];
    const a = byName.get(from).position.clone(), b = byName.get(to).position.clone();
    const middle = a.clone().lerp(b, .5); middle.y += Math.min(a.distanceTo(b) * .25, 2.5);
    const curve = new THREE.QuadraticBezierCurve3(a, middle, b);
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(64)), new THREE.LineBasicMaterial({ color: accent, transparent: true, opacity: .25 })); root.add(line);
    const packet = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, color: '#e1f5bd', blending: THREE.AdditiveBlending, transparent: true, opacity: .95, depthWrite: false })); packet.scale.setScalar(.32); root.add(packet);
    const trailGeometry = new THREE.BufferGeometry();
    trailGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(16 * 3), 3).setUsage(THREE.DynamicDrawUsage));
    const colors = new Float32Array(16 * 3);
    for (let i = 0; i < 16; i++) { const intensity = (i / 15) ** 2; colors.set([intensity * .78, intensity * .94, intensity * .64], i * 3); }
    trailGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const trail = new THREE.Line(trailGeometry, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: .65, blending: THREE.AdditiveBlending, depthWrite: false })); trail.frustumCulled = false; root.add(trail);
    return [{ from, to, line, packet, trail, curve }];
  });
  let frame = 0, visible = true, elapsed = 0, previous = 0, disposed = false;
  const clamp = value => Math.max(0, Math.min(1, value));
  const point = new THREE.Vector3();
  const trailPoint = new THREE.Vector3();
  const counters = [...document.querySelectorAll('[data-count]')];
  function draw(now = performance.now()) {
    if (disposed) return;
    const reduced = motion.matches;
    const t = reduced ? 3 : elapsed;
    root.position.y = reduced || mobile.matches ? 0 : Math.sin(t * .5) * .09;
    root.rotation.y = reduced || mobile.matches ? 0 : Math.sin(t * .16) * .018;
    root.scale.setScalar(.97 + .03 * clamp(t / .65));
    outlines.forEach(line => line.geometry.setDrawRange(0, Math.floor(line.geometry.attributes.position.count * clamp((t - .3) / .6))));
    root.updateMatrixWorld(true); camera.updateMatrixWorld();
    markers.forEach((m, i) => {
      const show = clamp((t - .75 - i * .035) / .3); m.group.visible = show > 0;
      const chosen = m.city.name === (hovered || active); m.sphere.scale.setScalar(chosen ? 1.8 : m.city.name === 'Астана' ? 1.35 : 1);
      m.halo.material.opacity = (mobile.matches ? .4 : .65) + (chosen ? .3 : 0);
      m.halo.scale.setScalar((m.city.name === 'Астана' ? 1.1 : .72) * (chosen ? 1.4 : 1));
      const pulse = reduced || mobile.matches ? .3 : (t * .38 + i * .13) % 1;
      m.ring.scale.setScalar(1 + pulse * 1.8); m.ring.material.opacity = (1 - pulse) * (chosen ? .7 : .32);
      point.copy(m.position); root.localToWorld(point); point.project(camera);
      m.label.style.left = `${(point.x * .5 + .5) * host.clientWidth}px`; m.label.style.top = `${(-point.y * .5 + .5) * host.clientHeight}px`;
      m.label.style.opacity = String(show); m.label.style.visibility = show > 0 && Math.abs(point.x) < .96 && Math.abs(point.y) < .96 ? 'visible' : 'hidden';
    });
    routes.forEach((route, i) => {
      const progress = clamp((t - 1.15 - i * .04) / .5); route.line.geometry.setDrawRange(0, Math.floor(65 * progress));
      route.line.material.opacity = [route.from, route.to].includes(hovered || active) ? .9 : .35;
      route.packet.visible = !reduced && !mobile.matches && progress === 1;
      route.trail.visible = route.packet.visible;
      if (route.packet.visible) {
        const head = (t * .095 + i * .17) % 1;
        route.curve.getPoint(head, route.packet.position);
        const positions = route.trail.geometry.attributes.position;
        for (let j = 0; j < 16; j++) { route.curve.getPoint(Math.max(0, head - (1 - j / 15) * .13), trailPoint); positions.setXYZ(j, trailPoint.x, trailPoint.y, trailPoint.z); }
        positions.needsUpdate = true;
      }
    });
    if (t <= 3 || reduced) counters.forEach(counter => { const value = String(Math.round(Number(counter.dataset.count) * (1 - (1 - clamp((t - 1.65) / .7)) ** 3))); if (counter.textContent !== value) counter.textContent = value; });
    renderer.render(scene, camera);
  }
  function tick(now) {
    frame = 0; if (!visible || document.hidden || disposed) return;
    elapsed += previous ? Math.min((now - previous) / 1000, .08) : 0; previous = now;
    controls.update(); draw(now);
    if (!motion.matches && (!mobile.matches || elapsed < 2.5)) frame = requestAnimationFrame(tick);
  }
  function resume() { if (!frame && visible && !document.hidden && !disposed) { previous = 0; frame = requestAnimationFrame(tick); } }
  renderOnce = () => { if (motion.matches || (mobile.matches && elapsed >= 2.5)) draw(); else resume(); };
  controls.addEventListener('change', () => { if (motion.matches || mobile.matches) draw(); });
  $('zoom-in').onclick = () => { camera.position.multiplyScalar(.94); controls.update(); renderOnce(); };
  $('zoom-out').onclick = () => { camera.position.multiplyScalar(1.06); controls.update(); renderOnce(); };
  $('reset').onclick = () => { resetCamera(); renderOnce(); };
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(host);
  const pauseBackground = () => document.body.classList.toggle('is-paused', !visible || document.hidden);
  const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; pauseBackground(); if (visible) resume(); else { cancelAnimationFrame(frame); frame = 0; } }); intersection.observe(host);
  const onVisibility = () => { pauseBackground(); if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } else resume(); };
  document.addEventListener('visibilitychange', onVisibility);
  motion.addEventListener('change', () => { controls.enableDamping = !motion.matches && !mobile.matches; renderOnce(); });
  mobile.addEventListener('change', () => { setDeviceControls(); resize(); });
  renderer.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); cancelAnimationFrame(frame); frame = 0; visible = false; $('map-message').hidden = false; $('map-message').textContent = 'Карта недоступна. Выберите город в списке ниже.'; });
  renderer.domElement.addEventListener('webglcontextrestored', () => { visible = true; $('map-message').hidden = true; resume(); });
  window.addEventListener('pagehide', e => {
    if (e.persisted) return;
    disposed = true; cancelAnimationFrame(frame); resizeObserver.disconnect(); intersection.disconnect(); controls.dispose();
    const geometries = new Set(), materials = new Set();
    scene.traverse(object => { if (object.geometry) geometries.add(object.geometry); if (object.material) (Array.isArray(object.material) ? object.material : [object.material]).forEach(m => materials.add(m)); });
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); glowTexture.dispose(); renderer.dispose();
  });
  resize(); $('map-message').hidden = true; document.body.classList.add('ready'); resume();
}
init().catch(error => {
  console.warn('Project geography:', error);
  $('map-message').textContent = '3D-карта недоступна. Выберите город в списке ниже.';
  document.querySelector('.controls').hidden = true;
});
