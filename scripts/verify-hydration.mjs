import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root = process.cwd();
const dist = path.join(root, 'dist');
const registry = JSON.parse(fs.readFileSync(path.join(root, 'src', 'data', 'seoRegistry.generated.json'), 'utf8'));
const indexablePages = registry.filter((entry) => entry.robots === 'index,follow');
const maximumCls = 0.1;
const liveMode = process.argv[2] === '--live';
const privateRuntimePath = /^\/(?:login|register|reset-password|staff|cabinet|client|admin|dashboard|internal|crm)(?:\/|$)/;

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

const resolveRequest = (requestPath) => {
  const decoded = decodeURIComponent(requestPath);
  const relative = decoded.replace(/^\/+/, '');
  const direct = path.resolve(dist, relative);
  const nested = path.resolve(dist, relative, 'index.html');
  if (!direct.startsWith(`${path.resolve(dist)}${path.sep}`) && direct !== path.resolve(dist)) return undefined;
  if (fs.existsSync(direct) && fs.statSync(direct).isFile()) return direct;
  if (fs.existsSync(nested) && fs.statSync(nested).isFile()) return nested;
  if (decoded === '/' && fs.existsSync(path.join(dist, 'index.html'))) return path.join(dist, 'index.html');
  if (privateRuntimePath.test(decoded) && fs.existsSync(path.join(dist, 'index.html'))) return path.join(dist, 'index.html');
  return undefined;
};

const staticServer = http.createServer((request, response) => {
  const pathname = new URL(request.url || '/', 'http://127.0.0.1').pathname;
  if (/^\/api\/public\/content\/(?:articles|cases|experts|regions|services|trust-documents)$/.test(pathname)) {
    response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ items: [], version: 'hydration-test' }));
    return;
  }
  const file = resolveRequest(pathname);
  if (!file) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }
  response.writeHead(200, {
    'cache-control': 'no-store',
    'content-type': contentTypes[path.extname(file).toLowerCase()] || 'application/octet-stream',
  });
  fs.createReadStream(file).pipe(response);
});

const listen = (server) => new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => resolve(server.address().port));
});
const closeServer = (server) => new Promise((resolve) => server.close(resolve));
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const chromeCandidates = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);
const chromePath = chromeCandidates.find((candidate) => fs.existsSync(candidate));
if (!chromePath) throw new Error('Hydration check: Chrome/Edge not found. Set CHROME_PATH.');

const reservePort = async () => {
  const server = http.createServer();
  const port = await listen(server);
  await closeServer(server);
  return port;
};

class CdpClient {
  constructor(socket) {
    this.socket = socket;
    this.sequence = 0;
    this.pending = new Map();
    this.listeners = new Map();
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result);
        return;
      }
      for (const listener of this.listeners.get(message.method) || []) listener(message.params);
    });
  }

  send(method, params = {}) {
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  on(method, listener) {
    this.listeners.set(method, [...(this.listeners.get(method) || []), listener]);
  }

  waitFor(method, timeout = 15000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`CDP timeout waiting for ${method}`)), timeout);
      this.on(method, (params) => {
        clearTimeout(timer);
        resolve(params);
      });
    });
  }
}

if (!liveMode) {
  for (const entry of indexablePages) {
    const file = entry.path === '/'
      ? path.join(dist, 'index.html')
      : path.join(dist, entry.path.slice(1), 'index.html');
    if (!fs.existsSync(file)) throw new Error(`Hydration check: prerendered route is missing: ${entry.path}.`);
  }
}

const sitePort = liveMode ? undefined : await listen(staticServer);
const debugPort = await reservePort();
const browserProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'ecoprogress-hydration-'));
const browser = spawn(chromePath, [
  '--headless=new',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--disable-crash-reporter',
  '--no-first-run',
  '--no-sandbox',
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${browserProfile}`,
  '--window-size=1440,1000',
  'about:blank',
], { stdio: 'ignore', windowsHide: true });

let socket;
try {
  let targets;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      targets = await fetch(`http://127.0.0.1:${debugPort}/json/list`).then((response) => response.json());
      if (targets.some((target) => target.type === 'page')) break;
    } catch {
      await delay(100);
    }
  }
  const target = targets?.find((item) => item.type === 'page');
  if (!target?.webSocketDebuggerUrl) throw new Error('Hydration check: Chrome DevTools endpoint did not start.');

  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  const cdp = new CdpClient(socket);
  const consoleErrors = [];
  const exceptions = [];
  cdp.on('Runtime.consoleAPICalled', (event) => {
    if (event.type !== 'error' && event.type !== 'warning') return;
    consoleErrors.push(event.args.map((arg) => arg.value ?? arg.description ?? '').join(' '));
  });
  cdp.on('Runtime.exceptionThrown', (event) => {
    exceptions.push(event.exceptionDetails.exception?.description || event.exceptionDetails.text || 'Unknown runtime exception');
  });
  cdp.on('Log.entryAdded', (event) => {
    if (event.entry.level === 'error') {
      consoleErrors.push(`${event.entry.text}${event.entry.url ? ` (${event.entry.url})` : ''}`);
    }
  });

  await Promise.all([
    cdp.send('Page.enable'),
    cdp.send('Runtime.enable'),
    cdp.send('Log.enable'),
  ]);
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `
      window.__ecoprogressCls = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) window.__ecoprogressCls += entry.value;
        }
      }).observe({ type: 'layout-shift', buffered: true });
    `,
  });
  const hydrationPattern = /Hydration failed|server rendered HTML didn't match|did not match|error while hydrating|Text content does not match|Minified React error #(418|423|425)/i;
  const results = [];
  for (const entry of indexablePages) {
    consoleErrors.length = 0;
    exceptions.length = 0;
    const loaded = cdp.waitFor('Page.loadEventFired');
    const pageUrl = liveMode ? entry.canonical : `http://127.0.0.1:${sitePort}${entry.path}`;
    await cdp.send('Page.navigate', { url: pageUrl });
    await loaded;
    await delay(750);

    const evaluation = await cdp.send('Runtime.evaluate', {
      expression: `({
        cls: window.__ecoprogressCls || 0,
        readyState: document.readyState,
        h1Count: document.querySelectorAll('h1').length,
        rootPrerendered: document.querySelector('#root')?.dataset.prerendered === 'true',
        rootChildren: document.querySelector('#root')?.children.length || 0,
        canonical: document.querySelector('link[rel="canonical"]')?.href || '',
        title: document.title
      })`,
      returnByValue: true,
    });
    const result = evaluation.result.value;
    const hydrationErrors = [...consoleErrors, ...exceptions].filter((message) => hydrationPattern.test(message));

    if (hydrationErrors.length) throw new Error(`Hydration mismatch at ${entry.path}:\n${hydrationErrors.join('\n')}`);
    if (exceptions.length) throw new Error(`Runtime exceptions after hydration at ${entry.path}:\n${exceptions.join('\n')}`);
    if (consoleErrors.length) throw new Error(`Console warnings/errors after hydration at ${entry.path}:\n${consoleErrors.join('\n')}`);
    if (result.readyState !== 'complete' || result.h1Count !== 1 || !result.rootPrerendered || result.rootChildren === 0) {
      throw new Error(`Hydration DOM invariant failed at ${entry.path}: ${JSON.stringify(result)}`);
    }
    if (result.canonical !== new URL(entry.canonical).href) {
      throw new Error(`Hydration canonical changed at ${entry.path}: ${result.canonical}`);
    }
    if (result.cls > maximumCls) throw new Error(`CLS ${result.cls.toFixed(4)} exceeds ${maximumCls} at ${entry.path}.`);
    results.push({ path: entry.path, cls: result.cls });
  }

  consoleErrors.length = 0;
  exceptions.length = 0;
  const homeLoaded = cdp.waitFor('Page.loadEventFired');
  await cdp.send('Page.navigate', { url: liveMode ? 'https://ecoprogress.kz/' : `http://127.0.0.1:${sitePort}/` });
  await homeLoaded;
  await delay(750);
  const loginLoaded = cdp.waitFor('Page.loadEventFired');
  const loginClick = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const link = document.querySelector('a[href="/login"]');
      if (!link) return false;
      link.click();
      return true;
    })()`,
    returnByValue: true,
  });
  if (!loginClick.result.value) throw new Error('Private navigation check: public login anchor is missing.');
  await loginLoaded;
  await delay(750);
  const loginEvaluation = await cdp.send('Runtime.evaluate', {
    expression: `({
      pathname: location.pathname,
      h1: document.querySelector('form h1')?.textContent?.trim() || '',
      hasForm: Boolean(document.querySelector('form')),
      notFound: document.body.textContent?.includes('Страница не найдена') || false
    })`,
    returnByValue: true,
  });
  const loginResult = loginEvaluation.result.value;
  if (loginResult.pathname !== '/login' || loginResult.h1 !== 'Вход клиента' || !loginResult.hasForm || loginResult.notFound) {
    throw new Error(`Private navigation check failed after clicking login: ${JSON.stringify(loginResult)}`);
  }
  if (exceptions.length) throw new Error(`Runtime exceptions after login navigation:\n${exceptions.join('\n')}`);
  if (consoleErrors.length) throw new Error(`Console warnings/errors after login navigation:\n${consoleErrors.join('\n')}`);

  const highestCls = results.reduce((highest, result) => result.cls > highest.cls ? result : highest);
  console.log(
    `${liveMode ? 'Live h' : 'H'}ydration check passed for all ${results.length} indexable pages: `
    + 'no mismatches, runtime exceptions '
    + `or console warnings/errors; highest CLS=${highestCls.cls.toFixed(4)} at ${highestCls.path}; login navigation passed.`,
  );
} finally {
  socket?.close();
  const browserExited = browser.exitCode === null
    ? new Promise((resolve) => browser.once('exit', resolve))
    : Promise.resolve();
  browser.kill();
  await Promise.race([browserExited, delay(3000)]);
  if (sitePort) await closeServer(staticServer);
  let cleanupError;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      fs.rmSync(browserProfile, { recursive: true, force: true });
      cleanupError = undefined;
      break;
    } catch (error) {
      cleanupError = error;
      await delay(100);
    }
  }
  if (cleanupError) console.warn(`Hydration check: temporary Chrome profile cleanup deferred (${cleanupError.code}).`);
}
