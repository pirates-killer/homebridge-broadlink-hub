'use strict';

// Local preview of the settings page outside Homebridge:
//   node test/ui-preview/serve.js [config.json] [port]
// Serves homebridge-ui/public with a stand-in for window.homebridge whose
// requests go to the real homebridge-ui/server.js (forked, like the Homebridge
// UI does). Starts an RM simulator and points the config's first host at it.
// Config edits stay in memory; GET /api/config shows the current state.

const http = require('http');
const fs = require('fs');
const path = require('path');
const { fork } = require('child_process');
const RMSimulator = require('../sim/rmSimulator');

const publicDir = path.join(__dirname, '..', '..', 'homebridge-ui', 'public');
const port = Number(process.argv[3] || 8581);

(async () => {
  const sim = new RMSimulator({ devtype: 0x520b });
  await sim.start();
  sim.learned = '26001a001d1d1d1d1d3a1d3a1d3a1d1d1d3a1d1d1d1d1d1d1d1d1d3a000d05';
  sim.learnAfter = 4;

  let config = [{ platform: 'BroadlinkRM', name: 'BroadLink Hub', hosts: [], accessories: [] }];
  if (process.argv[2]) {
    const file = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
    config = (file.platforms || [file]).filter((p) => p.platform === 'BroadlinkRM');
  }
  for (const block of config) {
    for (const h of block.hosts || []) {Object.assign(h, { address: '127.0.0.1', port: sim.port });}
    for (const a of block.accessories || []) {if (a.host) {a.host = '127.0.0.1';}}
  }

  const ui = fork(path.join(__dirname, '..', '..', 'homebridge-ui', 'server.js'), [], { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
  const pending = new Map();
  const listeners = new Set();
  let seq = 0;
  ui.on('message', (m) => {
    if (m.action === 'response') {const r = pending.get(m.payload.requestId); pending.delete(m.payload.requestId); if (r) {r(m.payload);}}
    if (m.action === 'stream') {for (const res of listeners) {res.write(`data: ${JSON.stringify(m.payload)}\n\n`);}}
  });

  const shim = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@4.6.2/dist/css/bootstrap.min.css">
<style>body{padding:1rem;max-width:960px;margin:auto}</style>
<script>
window.homebridge = (() => {
  const listeners = {};
  const es = new EventSource('/api/events');
  es.onmessage = (m) => { const p = JSON.parse(m.data); (listeners[p.event] || []).forEach((fn) => fn({ data: p.data })); };
  const post = (url, body) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json());
  const toast = (kind) => (msg) => { console.log('[toast ' + kind + ']', msg); const d = document.createElement('div'); d.className = 'alert alert-' + (kind === 'error' ? 'danger' : kind) + ' bh-toast'; d.textContent = msg; d.style = 'position:fixed;top:1rem;right:1rem;z-index:99'; document.body.append(d); setTimeout(() => d.remove(), 3000); };
  return {
    getPluginConfig: () => fetch('/api/config').then((r) => r.json()),
    updatePluginConfig: (c) => post('/api/config', c),
    savePluginConfig: async () => {},
    request: async (path, body) => { const r = await post('/api/request', { path, body }); if (!r.success) { throw Object.assign(new Error(r.data && r.data.message), r.data); } return r.data; },
    addEventListener: (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); },
    toast: { success: toast('success'), error: toast('error'), warning: toast('warning'), info: toast('info') },
    showSpinner() {}, hideSpinner() {}, showSchemaForm() {}, hideSchemaForm() {}, closeSettings() {},
  };
})();
</script></head><body>`;

  const body = (req) => new Promise((resolve) => {let s = ''; req.on('data', (c) => (s += c)); req.on('end', () => resolve(s ? JSON.parse(s) : null));});

  http.createServer(async (req, res) => {
    if (req.url === '/api/config' && req.method === 'GET') {res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify(config));}
    if (req.url === '/api/config' && req.method === 'POST') {config = await body(req); res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify(config));}
    if (req.url === '/api/sim') {res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify({ sent: sim.sent, port: sim.port }));}
    if (req.url === '/api/request') {
      const { path: p, body: b } = await body(req);
      const requestId = String(++seq);
      const reply = await new Promise((resolve) => {pending.set(requestId, resolve); ui.send({ action: 'request', path: p, body: b, requestId });});
      res.setHeader('content-type', 'application/json');
      return res.end(JSON.stringify(reply));
    }
    if (req.url === '/api/events') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
      listeners.add(res);
      req.on('close', () => listeners.delete(res));
      return undefined;
    }
    if (req.url === '/' || req.url.startsWith('/index.html')) {
      res.setHeader('content-type', 'text/html');
      return res.end(shim + fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8') + '</body></html>');
    }
    const file = path.join(publicDir, path.normalize(req.url.split('?')[0]).replace(/^(\.\.[/\\])+/, ''));
    if (file.startsWith(publicDir) && fs.existsSync(file)) {
      res.setHeader('content-type', file.endsWith('.js') ? 'text/javascript' : 'text/plain');
      return res.end(fs.readFileSync(file));
    }
    res.statusCode = 404;
    return res.end('not found');
  }).listen(port, '127.0.0.1', () => console.log(`Settings preview: http://127.0.0.1:${port}/  (RM simulator on 127.0.0.1:${sim.port})`));
})();
