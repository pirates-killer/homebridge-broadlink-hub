// BroadLink Hub settings page.
// Owns the whole platform config block: every change is a read-modify-write of
// the live config, so options this page doesn't know about are kept untouched.

(() => {
  const hb = window.homebridge;
  const $ = (id) => document.getElementById(id);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const DEFAULT = { platform: 'BroadlinkRM', name: 'BroadLink Hub', hideLearnButton: true, hideScanFrequencyButton: true, hosts: [], accessories: [] };

  // ---------------------------------------------------------------- helpers

  /** Tiny DOM builder; strings become text nodes (never HTML). */
  function h(tag, attrs = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === undefined || v === null || v === false) {continue;}
      if (k === 'class') {el.className = v;}
      else if (k.startsWith('on')) {el.addEventListener(k.slice(2), v);}
      else if (k === 'value') {el.value = v;}
      else if (k === 'checked') {el.checked = Boolean(v);}
      else {el.setAttribute(k, v === true ? '' : v);}
    }
    for (const kid of kids.flat()) {
      if (kid === undefined || kid === null || kid === false) {continue;}
      el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }
  const clear = (el) => {while (el.firstChild) {el.removeChild(el.firstChild);} return el;};
  const show = (el, on = true) => el.classList.toggle('bh-hidden', !on);
  const result = (el, text, kind) => {el.textContent = text || ''; el.className = `bh-result ${kind || ''}`;};

  const getPath = (o, p) => p.reduce((x, k) => (x === undefined || x === null ? undefined : x[k]), o);
  function setPath(o, p, v) {
    let x = o;
    for (let i = 0; i < p.length - 1; i++) {
      if (x[p[i]] === undefined || x[p[i]] === null || typeof x[p[i]] !== 'object') {x[p[i]] = typeof p[i + 1] === 'number' ? [] : {};}
      x = x[p[i]];
    }
    const last = p[p.length - 1];
    if (v === undefined || v === '' || (typeof v === 'number' && Number.isNaN(v))) {delete x[last];} else {x[last] = v;}
  }
  /** Codes are stored as hex strings, or as { data: hex, ... } objects (AC pseudo-mode etc.). */
  const codeOf = (v) => (typeof v === 'string' ? v : (v && typeof v.data === 'string' ? v.data : ''));
  function setCode(o, p, hex) {
    const cur = getPath(o, p);
    if (cur && typeof cur === 'object' && !Array.isArray(cur)) {
      if (hex) {cur.data = hex;} else {setPath(o, p, undefined);}
    } else {
      setPath(o, p, hex || undefined);
    }
  }
  const countCodes = (v) => (typeof v === 'string' ? (/^[0-9a-f]{8,}$/i.test(v) ? 1 : 0)
    : Array.isArray(v) ? v.reduce((n, x) => n + countCodes(x), 0)
      : v && typeof v === 'object' ? Object.values(v).reduce((n, x) => n + countCodes(x), 0) : 0);

  // ---------------------------------------------------------------- config

  let blocks = [];
  let cfg = clone(DEFAULT);

  async function load() {
    blocks = await hb.getPluginConfig();
    cfg = blocks[0] ? clone(blocks[0]) : clone(DEFAULT);
    cfg.platform = cfg.platform || 'BroadlinkRM';
  }

  async function commit() {
    blocks = [cfg, ...blocks.slice(1)];
    await hb.updatePluginConfig(clone(blocks));
    renderHosts();
    renderAccessories();
  }

  const hosts = () => (Array.isArray(cfg.hosts) ? cfg.hosts : []);
  const accessories = () => (Array.isArray(cfg.accessories) ? cfg.accessories : []);
  const normMac = (m) => String(m || '').toLowerCase().replace(/-/g, ':');
  const findHost = (ref) => hosts().find((x) => x.address === ref || normMac(x.mac) === normMac(ref));
  const hostLabel = (ref) => {
    if (!ref) {return 'first device found';}
    const x = findHost(ref);
    const model = x && status.get(x.address)?.device?.model;
    return x ? `${model || (x.isRFSupported ? 'RM (IR + RF)' : 'RM')} · ${x.address}` : `${ref} (not in the device list)`;
  };

  // ---------------------------------------------------------------- devices

  const status = new Map(); // address -> probe result

  function renderHosts() {
    const table = clear($('bh-hosts'));
    if (!hosts().length) {
      table.append(h('tr', {}, h('td', {}, 'No devices added yet: Homebridge will look for them automatically when it starts. Add them here for a faster, more reliable start.')));
      return;
    }
    table.append(h('tr', {}, h('th', {}, 'Device'), h('th', {}, 'IP address'), h('th', {}, 'MAC'), h('th', {}, '')));
    hosts().forEach((x, i) => {
      const st = status.get(x.address);
      const badge = !st ? h('span', { class: 'bh-badge' }, 'checking…')
        : !st.ok ? h('span', { class: 'bh-badge bad' }, 'not answering')
          : st.device.isLocked ? h('span', { class: 'bh-badge warn' }, 'locked in BroadLink app')
            : h('span', { class: 'bh-badge ok' }, 'online');
      const model = st && st.ok ? st.device.model : (x.isRFSupported ? 'RM (IR + RF)' : 'RM (IR)');
      table.append(h('tr', {},
        h('td', {}, model, badge),
        h('td', {}, x.address),
        h('td', {}, h('code', {}, x.mac || '')),
        h('td', { class: 'bh-actions' }, removeButton(async () => {
          cfg.hosts = hosts().filter((_, j) => j !== i);
          await commit();
        }))));
      if (!st) {
        status.set(x.address, null);
        hb.request('/probe', { address: x.address, port: x.port }).then((r) => {
          status.set(x.address, r);
          if (r.ok && (x.mac !== r.device.mac || x.isRM4 !== r.device.rm4 || x.isRFSupported !== r.device.rf) && r.device.supported) {
            // Keep the flags in sync with what the device reports.
            Object.assign(x, { mac: r.device.mac, isRM4: r.device.rm4, isRFSupported: r.device.rf });
            commit();
          } else {
            renderHosts();
            renderAccessories(); // device labels show the probed model
          }
        });
      }
    });
  }

  /** Two-click delete without browser dialogs. */
  function removeButton(onConfirm, label = 'Remove') {
    const btn = h('button', { class: 'btn btn-sm btn-outline-danger' }, label);
    let armed = false;
    btn.addEventListener('click', () => {
      if (armed) {onConfirm(); return;}
      armed = true;
      btn.textContent = 'Click again';
      setTimeout(() => {armed = false; btn.textContent = label;}, 3000);
    });
    return btn;
  }

  async function addHost(d) {
    const existing = hosts().find((x) => normMac(x.mac) === normMac(d.mac) || x.address === d.address);
    const entry = { address: d.address, mac: d.mac, isRM4: d.rm4, isRFSupported: d.rf };
    if (existing) {Object.assign(existing, entry);} else {cfg.hosts = [...hosts(), entry];}
    status.set(d.address, { ok: true, device: d });
    await commit();
  }

  async function scan() {
    const btn = $('bh-scan');
    btn.disabled = true;
    result($('bh-scan-result'), 'Looking for BroadLink devices (about 3 seconds)…');
    const table = clear($('bh-found'));
    try {
      const r = await hb.request('/scan', { sweep: true });
      if (!r.devices.length) {
        result($('bh-scan-result'), 'No BroadLink device answered. Check it is powered and on the same network, or add it by IP address.', 'bad');
        return;
      }
      result($('bh-scan-result'), `Found ${r.devices.length} device${r.devices.length > 1 ? 's' : ''}:`, 'ok');
      for (const d of r.devices) {
        const added = hosts().some((x) => normMac(x.mac) === normMac(d.mac));
        table.append(h('tr', {},
          h('td', {}, d.model, d.isLocked ? h('span', { class: 'bh-badge warn' }, 'locked') : null),
          h('td', {}, d.address),
          h('td', {}, h('code', {}, d.mac)),
          h('td', { class: 'bh-actions' }, !d.supported ? h('span', { class: 'bh-badge' }, 'not an RM remote')
            : added ? h('span', { class: 'bh-badge ok' }, 'added')
              : h('button', { class: 'btn btn-sm btn-primary', onclick: async () => {await addHost(d); scanRefresh(d);} }, 'Add'))));
      }
    } catch (err) {
      result($('bh-scan-result'), err.message || String(err), 'bad');
    } finally {
      btn.disabled = false;
    }
  }
  function scanRefresh(d) {
    for (const row of $('bh-found').querySelectorAll('tr')) {
      if (row.textContent.includes(d.mac)) {
        const cell = row.lastChild;
        clear(cell).append(h('span', { class: 'bh-badge ok' }, 'added'));
      }
    }
  }

  async function addByIp() {
    const address = $('bh-ip').value.trim();
    const r = await hb.request('/probe', { address });
    if (!r.ok) {result($('bh-scan-result'), r.error, 'bad'); return;}
    if (!r.device.supported) {result($('bh-scan-result'), `${address} is a ${r.device.model}, not an RM remote.`, 'bad'); return;}
    await addHost(r.device);
    $('bh-ip').value = '';
    result($('bh-scan-result'), `Added ${r.device.model} at ${address}.`, 'ok');
  }

  // ---------------------------------------------------------------- accessory types

  const code = (path, label, hint) => ({ kind: 'code', path, label, hint });
  const num = (path, label, attrs = {}) => ({ kind: 'num', path, label, attrs });
  const bool = (path, label) => ({ kind: 'bool', path, label });
  const choice = (path, label, options) => ({ kind: 'choice', path, label, options });
  const section = (label, hint) => ({ kind: 'section', label, hint });

  const onOff = (acc) => (typeof acc.data === 'string'
    ? [code(['data'], 'Code', 'Sent when turned on.'), { kind: 'split' }]
    : [code(['data', 'on'], 'On code'), code(['data', 'off'], 'Off code', 'Leave empty if one button toggles power.')]);

  const TV_KEYS = [['arrowUp', 'Up'], ['arrowDown', 'Down'], ['arrowLeft', 'Left'], ['arrowRight', 'Right'], ['select', 'OK / Select'],
    ['back', 'Back'], ['exit', 'Exit'], ['info', 'Info'], ['playPause', 'Play / Pause'], ['rewind', 'Rewind'],
    ['fastForward', 'Fast forward'], ['previousTrack', 'Previous'], ['nextTrack', 'Next']];
  const INPUT_TYPES = ['hdmi', 'tuner', 'application', 'airplay', 'usb', 'composite_video', 'component_video', 's_video', 'dvi', 'home_screen', 'other'];

  const TYPES = {
    switch: { label: 'Switch', desc: 'Anything with on/off codes', fields: (a) => [...onOff(a),
      section('Options'), bool(['enableAutoOff'], 'Turn off automatically'), num(['onDuration'], 'Seconds before turning off', { min: 1 }),
      bool(['stateless'], 'Stateless (always shows off; for scene buttons)')] },
    outlet: { label: 'Outlet', desc: 'Plug or power strip', fields: (a) => onOff(a) },
    light: { label: 'Light', desc: 'On/off light; brightness and colour codes via JSON', fields: (a) => [...onOff(a),
      section('Options'), bool(['enableAutoOff'], 'Turn off automatically'), num(['onDuration'], 'Seconds before turning off', { min: 1 })] },
    fan: { label: 'Fan', desc: 'On/off, speeds, swing, direction', fields: () => [
      code(['data', 'on'], 'On code'), code(['data', 'off'], 'Off code'),
      { kind: 'fanSpeeds' },
      section('Extras (optional)'), code(['data', 'swingToggle'], 'Swing / oscillate'),
      code(['data', 'clockwise'], 'Direction: clockwise'), code(['data', 'counterClockwise'], 'Direction: counter-clockwise'),
      bool(['hideSwingMode'], 'Hide swing in the Home app'), bool(['hideRotationDirection'], 'Hide direction in the Home app')] },
    tv: { label: 'TV / receiver', desc: 'Power, inputs, remote keys, volume', fields: () => [
      choice(['subType'], 'Shown in the Home app as', [['tv', 'TV'], ['stb', 'Set-top box'], ['receiver', 'Audio receiver'], ['stick', 'Streaming stick']]),
      code(['data', 'on'], 'Power on'), code(['data', 'off'], 'Power off', 'Leave empty if one button toggles power.'),
      { kind: 'tvInputs' },
      section('Volume'), code(['data', 'volume', 'up'], 'Volume up'), code(['data', 'volume', 'down'], 'Volume down'), code(['data', 'volume', 'mute'], 'Mute'),
      section('Remote (Control Centre remote)'), ...TV_KEYS.map(([k, l]) => code(['data', 'remote', k], l))] },
    'air-conditioner': { label: 'Air conditioner', desc: 'Off plus a code per mode and temperature', fields: () => [
      code(['data', 'off'], 'Off'), code(['data', 'on'], 'On (optional)', 'Only needed with "Send On before other codes".'),
      section('Temperature range'),
      num(['minTemperature'], 'Lowest °C', { min: -15, max: 50 }), num(['maxTemperature'], 'Highest °C', { min: -15, max: 50 }),
      num(['tempStepSize'], 'Step', { min: 0.5, max: 5, step: 0.5 }),
      num(['defaultCoolTemperature'], 'Cool mode starts at °C'), num(['defaultHeatTemperature'], 'Heat mode starts at °C'),
      { kind: 'acGrid' },
      section('Options'), bool(['turnOnWhenOff'], 'Send On before other codes when the AC is off'),
      bool(['ignoreTemperatureWhenOff'], 'Ignore temperature changes while off'), bool(['preventResendHex'], 'Don’t resend a code that is already active'),
      bool(['noHumidity'], 'Hide humidity')] },
    'garage-door-opener': { label: 'Garage door', desc: 'Open and close codes', fields: () => [
      code(['data', 'open'], 'Open'), code(['data', 'close'], 'Close'),
      num(['openDuration'], 'Seconds to open', { min: 0 }), num(['closeDuration'], 'Seconds to close', { min: 0 })] },
    lock: { label: 'Lock', desc: 'Lock and unlock codes', fields: () => [code(['data', 'lock'], 'Lock'), code(['data', 'unlock'], 'Unlock')] },
    'window-covering': { label: 'Blind / curtain', desc: 'Open, close, stop with timing', fields: () => [
      code(['data', 'open'], 'Open'), code(['data', 'close'], 'Close'), code(['data', 'stop'], 'Stop'),
      num(['totalDurationOpen'], 'Seconds to open fully', { min: 1 }), num(['totalDurationClose'], 'Seconds to close fully', { min: 1 })] },
  };
  const MORE_TYPES = [['heater-cooler', 'Heater / cooler'], ['air-purifier', 'Air purifier'], ['humidifier-dehumidifier', 'Humidifier / dehumidifier'],
    ['temperatureSensor', 'Temperature sensor'], ['humiditySensor', 'Humidity sensor'], ['switch-multi', 'Switch (multiple codes)'],
    ['switch-repeat', 'Switch (repeat code)'], ['fanv1', 'Fan (old style)'], ['window', 'Window']];
  const typeLabel = (t) => (TYPES[t] ? TYPES[t].label : (MORE_TYPES.find(([k]) => k === t) || [t, t])[1]);

  // ---------------------------------------------------------------- accessory list

  function renderAccessories() {
    const table = clear($('bh-accessories'));
    $('bh-acc-count').textContent = String(accessories().length);
    if (!accessories().length) {
      table.append(h('tr', {}, h('td', {}, 'No accessories yet. Add one, then learn its codes with your remote.')));
      return;
    }
    table.append(h('tr', {}, h('th', {}, 'Name'), h('th', {}, 'Type'), h('th', {}, 'Device'), h('th', {}, 'Codes'), h('th', {}, '')));
    accessories().forEach((a, i) => {
      table.append(h('tr', {},
        h('td', {}, a.name || '(no name)', a.disabled ? h('span', { class: 'bh-badge' }, 'disabled') : null),
        h('td', {}, typeLabel(a.type)),
        h('td', {}, hostLabel(a.host)),
        h('td', {}, String(countCodes(a.data))),
        h('td', { class: 'bh-actions' },
          h('button', { class: 'btn btn-sm btn-secondary', onclick: () => openEditor(i) }, 'Edit'), ' ',
          h('button', { class: 'btn btn-sm btn-outline-secondary', onclick: () => duplicate(i) }, 'Duplicate'), ' ',
          removeButton(async () => {cfg.accessories = accessories().filter((_, j) => j !== i); await commit();}, 'Delete'))));
    });
  }

  async function duplicate(i) {
    const copy = clone(accessories()[i]);
    let n = 2;
    while (accessories().some((a) => a.name === `${copy.name} ${n}`)) {n++;}
    copy.name = `${copy.name} ${n}`;
    cfg.accessories = [...accessories(), copy];
    await commit();
    openEditor(accessories().length - 1);
  }

  // ---------------------------------------------------------------- editor

  let ed = null; // { index, acc, originalName, tab }

  function openEditor(index) {
    const isNew = index === undefined;
    ed = { index: isNew ? -1 : index, acc: isNew ? null : clone(accessories()[index]), originalName: isNew ? null : accessories()[index].name, tab: 'form' };
    // A TV with a single power code string behaves exactly like { on: code }
    // (it sends `on || data`), and the form needs an object to add more codes.
    if (ed.acc && ed.acc.type === 'tv' && typeof ed.acc.data === 'string') {ed.acc.data = { on: ed.acc.data };}
    show($('bh-editor'));
    $('bh-ed-title').textContent = isNew ? 'New accessory: choose a type' : `Edit "${ed.acc.name}"`;
    result($('bh-ed-result'), '');
    if (isNew) {renderTypePicker();} else {renderEditorBody();}
    $('bh-editor').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderTypePicker() {
    show($('bh-ed-body'), false);
    const box = clear($('bh-ed-types'));
    show(box);
    const pick = (type) => {
      ed.acc = { name: '', type, host: hosts()[0]?.address, data: {} };
      $('bh-ed-title').textContent = `New ${typeLabel(type).toLowerCase()}`;
      show(box, false);
      renderEditorBody();
      $('bh-ed-name').focus();
    };
    for (const [type, t] of Object.entries(TYPES)) {
      box.append(h('button', { class: 'btn btn-outline-primary bh-type', onclick: () => pick(type) }, t.label, h('small', {}, t.desc)));
    }
    const more = h('select', { class: 'form-control' }, h('option', { value: '' }, 'More types (set up in JSON)…'),
      MORE_TYPES.map(([k, l]) => h('option', { value: k }, l)));
    more.addEventListener('change', () => {if (more.value) {pick(more.value); setTab('json');}});
    box.append(h('div', { class: 'bh-type' }, more));
  }

  function renderEditorBody() {
    show($('bh-ed-types'), false);
    show($('bh-ed-body'));
    $('bh-ed-name').value = ed.acc.name || '';
    const sel = clear($('bh-ed-host'));
    sel.append(h('option', { value: '' }, 'First device found'));
    for (const x of hosts()) {sel.append(h('option', { value: x.address }, hostLabel(x.address)));}
    if (ed.acc.host && !findHost(ed.acc.host)) {sel.append(h('option', { value: ed.acc.host }, `${ed.acc.host} (not in the device list)`));}
    sel.value = ed.acc.host ? (findHost(ed.acc.host)?.address || ed.acc.host) : '';
    setTab(TYPES[ed.acc.type] ? ed.tab : 'json');
  }

  function setTab(tab) {
    if (ed.tab === 'json' && tab !== 'json' && !applyJson()) {return;}
    ed.tab = tab;
    for (const b of document.querySelectorAll('#bh-editor [data-tab]')) {
      b.className = `btn btn-sm ${b.dataset.tab === tab ? 'btn-secondary' : 'btn-outline-secondary'}`;
    }
    show($('bh-ed-form'), tab === 'form');
    show($('bh-ed-json'), tab === 'json');
    if (tab === 'json') {
      $('bh-ed-json-text').value = JSON.stringify(ed.acc, null, 2);
      result($('bh-ed-json-result'), '');
    } else {
      renderForm();
    }
  }

  function applyJson() {
    try {
      const parsed = JSON.parse($('bh-ed-json-text').value);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {throw new Error('must be one JSON object');}
      if (!parsed.type) {throw new Error('"type" is required');}
      ed.acc = parsed;
      $('bh-ed-name').value = parsed.name || '';
      return true;
    } catch (err) {
      result($('bh-ed-json-result'), `JSON error: ${err.message}`, 'bad');
      return false;
    }
  }

  function renderForm() {
    const box = clear($('bh-ed-form'));
    const t = TYPES[ed.acc.type];
    if (!t) {box.append(h('div', { class: 'bh-hint' }, 'This type is edited in the JSON tab.')); return;}
    let row = null; // consecutive number fields share one row
    for (const f of t.fields(ed.acc)) {
      if (f.kind === 'num') {
        if (!row) {row = h('div', { class: 'bh-row', style: 'margin:.25rem 0' }); box.append(row);}
        row.append(renderField(f));
      } else {
        row = null;
        box.append(renderField(f));
      }
    }
  }

  function codeRow(label, get, set, hint) {
    const has = Boolean(get());
    return h('div', { class: 'bh-code-row' },
      h('div', { class: 'bh-label' }, label, hint ? h('div', { class: 'bh-hint', style: 'margin:0' }, hint) : null),
      h('span', { class: has ? 'bh-code-set' : '' }, has ? '● learned' : 'not set'),
      h('button', { class: 'btn btn-sm btn-secondary bh-code-btn', onclick: () => openDrawer({ title: label, get, set }) }, has ? 'Change' : 'Learn / paste'));
  }

  function renderField(f) {
    const a = ed.acc;
    switch (f.kind) {
      case 'section':
        return h('div', { class: 'bh-section' }, f.label, f.hint ? h('div', { class: 'bh-hint' }, f.hint) : null);
      case 'code':
        return codeRow(f.label, () => codeOf(getPath(a, f.path)), (hex) => setCode(a, f.path, hex), f.hint);
      case 'split':
        return h('div', { class: 'bh-hint' }, 'This accessory uses one code. ',
          h('button', { class: 'btn btn-sm btn-link', onclick: () => {a.data = { on: a.data }; renderForm();} }, 'Use separate on/off codes'));
      case 'num': {
        const input = h('input', { class: 'form-control', type: 'number', value: getPath(a, f.path) ?? '', ...f.attrs });
        input.addEventListener('change', () => setPath(a, f.path, input.value === '' ? undefined : Number(input.value)));
        input.addEventListener('change', () => {if (ed.acc.type === 'air-conditioner') {renderForm();}});
        return h('div', { class: 'bh-field', style: 'flex:1 1 8rem' }, h('label', {}, f.label), input);
      }
      case 'bool': {
        const input = h('input', { type: 'checkbox', checked: Boolean(getPath(a, f.path)) });
        input.addEventListener('change', () => setPath(a, f.path, input.checked ? true : undefined));
        return h('label', { style: 'display:flex;gap:.4rem;align-items:center;margin:.3rem 0' }, input, f.label);
      }
      case 'choice': {
        const sel = h('select', { class: 'form-control' }, f.options.map(([v, l]) => h('option', { value: v }, l)));
        sel.value = getPath(a, f.path) || f.options[0][0];
        sel.addEventListener('change', () => setPath(a, f.path, sel.value));
        return h('div', { class: 'bh-field', style: 'margin:.25rem 0' }, h('label', {}, f.label), sel);
      }
      case 'fanSpeeds': return fanSpeeds(a);
      case 'tvInputs': return tvInputs(a);
      case 'acGrid': return acGrid(a);
      default: return h('div');
    }
  }

  function fanSpeeds(a) {
    const box = h('div', {}, h('div', { class: 'bh-section' }, 'Speeds', h('div', { class: 'bh-hint' }, 'One code per speed (percent). The Home app slider snaps to the closest one.')));
    const speeds = Object.keys(a.data || {}).map((k) => k.match(/^fanSpeed(\d+)$/)).filter(Boolean).map((m) => Number(m[1])).sort((x, y) => x - y);
    for (const s of speeds) {
      const p = ['data', `fanSpeed${s}`];
      const row = codeRow(`Speed ${s}%`, () => codeOf(getPath(a, p)), (hex) => setCode(a, p, hex));
      row.append(removeButton(() => {setPath(a, p, undefined); renderForm();}, '×'));
      box.append(row);
    }
    const input = h('input', { class: 'form-control', type: 'number', min: 1, max: 100, placeholder: 'e.g. 33' });
    box.append(h('div', { class: 'bh-row', style: 'margin-top:.4rem' },
      h('div', { class: 'bh-field' }, h('label', {}, 'Add a speed (%)'), input),
      h('button', { class: 'btn btn-sm btn-secondary', onclick: () => {
        const s = Math.round(Number(input.value));
        if (s >= 1 && s <= 100) {a.data = a.data || {}; if (a.data[`fanSpeed${s}`] === undefined) {a.data[`fanSpeed${s}`] = '';} renderForm();}
      } }, 'Add')));
    return box;
  }

  function tvInputs(a) {
    const box = h('div', {}, h('div', { class: 'bh-section' }, 'Inputs', h('div', { class: 'bh-hint' }, 'Shown as the input picker in the Home app.')));
    const list = Array.isArray(a.data?.inputs) ? a.data.inputs : [];
    list.forEach((inp, i) => {
      const name = h('input', { class: 'form-control form-control-sm', value: inp.name || '', placeholder: 'HDMI 1' });
      name.addEventListener('change', () => {inp.name = name.value;});
      const type = h('select', { class: 'form-control form-control-sm' }, INPUT_TYPES.map((v) => h('option', { value: v }, v.replace(/_/g, ' '))));
      type.value = inp.type || 'hdmi';
      type.addEventListener('change', () => {inp.type = type.value;});
      const row = codeRow('', () => codeOf(inp.data), (hex) => {inp.data = hex;});
      row.firstChild.append(h('div', { class: 'bh-row' }, h('div', { class: 'bh-grow' }, name), h('div', {}, type)));
      row.append(removeButton(() => {list.splice(i, 1); renderForm();}, '×'));
      box.append(row);
    });
    box.append(h('button', { class: 'btn btn-sm btn-secondary', style: 'margin-top:.4rem', onclick: () => {
      a.data = a.data && typeof a.data === 'object' ? a.data : {};
      a.data.inputs = [...list, { name: `Input ${list.length + 1}`, type: 'hdmi', data: '' }];
      renderForm();
    } }, 'Add input'));
    return box;
  }

  function acGrid(a) {
    const min = Number(a.minTemperature ?? 16);
    const max = Number(a.maxTemperature ?? 30);
    const step = Number(a.tempStepSize || 1);
    const modes = [['cool', 'Cool'], ['heat', 'Heat'], ['auto', 'Auto'], ['temperature', 'Any mode']];
    const box = h('div', {}, h('div', { class: 'bh-section' }, 'Temperature codes',
      h('div', { class: 'bh-hint' }, 'Most AC remotes send everything (mode + temperature + fan) in one code, so learn one per mode and temperature you use. "Any mode" codes are used when a mode has no code of its own.')));
    if (!(max >= min) || (max - min) / step > 60) {box.append(h('div', { class: 'bh-result bad' }, 'Check the temperature range.')); return box;}
    const table = h('table', { class: 'bh-grid' });
    table.append(h('tr', {}, h('th', {}, '°C'), modes.map(([, l]) => h('th', {}, l))));
    for (let t = min; t <= max + 1e-9; t += step) {
      const temp = Number(t.toFixed(1));
      table.append(h('tr', {}, h('th', {}, String(temp)), modes.map(([m, l]) => {
        const p = ['data', `${m}${temp}`];
        const has = Boolean(codeOf(getPath(a, p)));
        return h('td', {}, h('button', {
          class: `btn btn-sm bh-dot ${has ? 'btn-success' : 'btn-outline-secondary'}`,
          title: `${l} ${temp}°C`,
          onclick: () => openDrawer({ title: `${l} ${temp} °C`, get: () => codeOf(getPath(a, p)), set: (hex) => setCode(a, p, hex) }),
        }, has ? '●' : '+'));
      })));
    }
    box.append(table);
    return box;
  }

  async function saveEditor() {
    if (ed.tab === 'json' && !applyJson()) {return;}
    const acc = ed.acc;
    acc.name = $('bh-ed-name').value.trim();
    const host = $('bh-ed-host').value;
    if (host) {acc.host = host;} else {delete acc.host;}
    if (!acc.name) {result($('bh-ed-result'), 'Give it a name.', 'bad'); return;}
    if (accessories().some((x, i) => i !== ed.index && x.name === acc.name)) {
      result($('bh-ed-result'), 'Another accessory already has this name. Names must be unique.', 'bad');
      return;
    }
    // Drop empty codes left by "Add speed" / "Add input" that were never learned.
    if (acc.data && typeof acc.data === 'object' && !Array.isArray(acc.data)) {
      for (const [k, v] of Object.entries(acc.data)) {if (v === '') {delete acc.data[k];}}
    }
    const list = [...accessories()];
    if (ed.index >= 0) {list[ed.index] = acc;} else {list.push(acc);}
    cfg.accessories = list;
    await commit();
    closeEditor();
    hb.toast.success(`"${acc.name}" saved. Press Save below to apply.`);
  }

  function closeEditor() {
    ed = null;
    show($('bh-editor'), false);
    closeDrawer();
  }

  // ---------------------------------------------------------------- code drawer

  let drawer = null; // { title, get, set, tool }
  let learning = false;

  function hostForRequests() {
    const ref = $('bh-dr-host').value;
    return findHost(ref) || (ref ? { address: ref } : null);
  }

  function openDrawer(ctx) {
    drawer = ctx;
    show($('bh-drawer'));
    $('bh-dr-title').textContent = ctx.tool ? 'Code tool' : `Code: ${ctx.title}`;
    $('bh-dr-done').textContent = ctx.tool ? 'Copy code' : 'Use this code';
    $('bh-dr-code').value = ctx.get() || '';
    result($('bh-dr-result'), '');
    $('bh-dr-stage').textContent = '';
    const sel = clear($('bh-dr-host'));
    for (const x of hosts()) {sel.append(h('option', { value: x.address }, hostLabel(x.address)));}
    if (!hosts().length) {sel.append(h('option', { value: '' }, 'Add a BroadLink device first (top of this page)'));}
    const pref = ed?.acc?.host ? (findHost(ed.acc.host)?.address || ed.acc.host) : hosts()[0]?.address;
    if (pref) {sel.value = pref;}
    updateRfButton();
    $('bh-drawer').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function updateRfButton() {
    const x = findHost($('bh-dr-host').value);
    $('bh-dr-rf').disabled = Boolean(x) && x.isRFSupported === false;
    $('bh-dr-rf').title = $('bh-dr-rf').disabled ? 'This model has no RF radio' : '';
  }

  async function closeDrawer() {
    if (learning) {await hb.request('/learn/cancel');}
    learning = false;
    drawer = null;
    show($('bh-drawer'), false);
  }

  const STAGES = {
    ready: 'Ready: point your remote at the BroadLink and press the button once.',
    sweeping: 'Hold the remote close to the BroadLink and keep the button pressed…',
    frequency: 'Signal found. Release the button.',
    press: 'Now press the button briefly, once.',
    code: 'Got it.',
    timeout: 'Nothing received. Try again, closer to the BroadLink.',
    cancelled: 'Stopped.',
    error: 'Something went wrong.',
  };

  async function startLearning(kind) {
    const host = hostForRequests();
    if (!host) {result($('bh-dr-result'), 'Add a BroadLink device first.', 'bad'); return;}
    result($('bh-dr-result'), '');
    $('bh-dr-stage').textContent = 'Connecting to the BroadLink…';
    setLearningUi(true);
    const r = await hb.request('/learn/start', { host, kind });
    if (!r.ok) {
      setLearningUi(false);
      $('bh-dr-stage').textContent = '';
      result($('bh-dr-result'), r.error, 'bad');
    }
  }

  function setLearningUi(on) {
    learning = on;
    show($('bh-dr-stop'), on);
    $('bh-dr-ir').disabled = on;
    $('bh-dr-rf').disabled = on;
    if (!on) {updateRfButton();}
  }

  function onLearnEvent(ev) {
    if (!drawer) {return;}
    const text = STAGES[ev.stage] || ev.stage;
    $('bh-dr-stage').textContent = ev.stage === 'frequency' && ev.mhz ? `Signal found at ${ev.mhz.toFixed(2)} MHz. Release the button.` : (ev.message && ev.stage === 'error' ? `${text} ${ev.message}` : text);
    if (['code', 'timeout', 'cancelled', 'error'].includes(ev.stage)) {setLearningUi(false);}
    if (ev.stage === 'code') {
      $('bh-dr-code').value = ev.hex;
      result($('bh-dr-result'), 'Code learned. Press "Test" to check it, then "Use this code".', 'ok');
    }
  }

  async function testCode() {
    const host = hostForRequests();
    if (!host) {result($('bh-dr-result'), 'Add a BroadLink device first.', 'bad'); return;}
    result($('bh-dr-result'), 'Sending…');
    const r = await hb.request('/send', { host, code: $('bh-dr-code').value });
    result($('bh-dr-result'), r.ok ? `Sent (acknowledged in ${r.ms} ms). Did the device react?` : r.error, r.ok ? 'ok' : 'bad');
  }

  async function useCode() {
    const text = $('bh-dr-code').value.trim();
    if (!text) {
      if (!drawer.tool) {drawer.set(''); renderForm();}
      await closeDrawer();
      return;
    }
    const r = await hb.request('/convert', { text });
    if (!r.ok) {result($('bh-dr-result'), r.error, 'bad'); return;}
    if (drawer.tool) {
      $('bh-dr-code').value = r.hex;
      try {await navigator.clipboard.writeText(r.hex); result($('bh-dr-result'), `Copied${r.format !== 'hex' ? ` (converted from ${r.format})` : ''}.`, 'ok');} catch {
        $('bh-dr-code').select();
        result($('bh-dr-result'), 'Selected: press Ctrl/Cmd+C to copy.', 'ok');
      }
      return;
    }
    drawer.set(r.hex);
    if (r.format !== 'hex') {hb.toast.info(`Converted from ${r.format} to BroadLink hex.`);}
    await closeDrawer();
    renderForm();
  }

  // ---------------------------------------------------------------- settings

  function renderSettings() {
    $('bh-loglevel').value = cfg.logLevel || '';
    $('bh-sendgap').value = cfg.sendGap ?? '';
    $('bh-retries').value = cfg.retries ?? '';
    $('bh-hidelearn').checked = Boolean(cfg.hideLearnButton && cfg.hideScanFrequencyButton);
  }

  function bindSettings() {
    const save = async () => {
      setPath(cfg, ['logLevel'], $('bh-loglevel').value || undefined);
      setPath(cfg, ['sendGap'], $('bh-sendgap').value === '' ? undefined : Number($('bh-sendgap').value));
      setPath(cfg, ['retries'], $('bh-retries').value === '' ? undefined : Number($('bh-retries').value));
      const hide = $('bh-hidelearn').checked;
      cfg.hideLearnButton = hide;
      cfg.hideScanFrequencyButton = hide;
      await commit();
      result($('bh-settings-result'), 'Updated. Press Save below to apply.', 'ok');
    };
    for (const id of ['bh-loglevel', 'bh-sendgap', 'bh-retries', 'bh-hidelearn']) {$(id).addEventListener('change', save);}
  }

  // ---------------------------------------------------------------- boot

  async function boot() {
    hb.showSpinner();
    try {
      await load();
      if (!blocks[0]) {await commit();} // first run: create the platform block
      renderHosts();
      renderAccessories();
      renderSettings();
    } finally {
      hb.hideSpinner();
    }

    $('bh-scan').addEventListener('click', scan);
    $('bh-ip-add').addEventListener('click', addByIp);
    $('bh-ip').addEventListener('keydown', (e) => {if (e.key === 'Enter') {addByIp();}});
    $('bh-add').addEventListener('click', () => openEditor());
    $('bh-ed-save').addEventListener('click', saveEditor);
    $('bh-ed-cancel').addEventListener('click', closeEditor);
    $('bh-ed-name').addEventListener('input', () => {
      show($('bh-ed-rename'), Boolean(ed && ed.originalName && $('bh-ed-name').value.trim() !== ed.originalName));
    });
    for (const b of document.querySelectorAll('#bh-editor [data-tab]')) {b.addEventListener('click', () => setTab(b.dataset.tab));}
    $('bh-dr-ir').addEventListener('click', () => startLearning('ir'));
    $('bh-dr-rf').addEventListener('click', () => startLearning('rf'));
    $('bh-dr-stop').addEventListener('click', () => hb.request('/learn/cancel'));
    $('bh-dr-host').addEventListener('change', updateRfButton);
    $('bh-dr-test').addEventListener('click', testCode);
    $('bh-dr-clear').addEventListener('click', () => {$('bh-dr-code').value = ''; result($('bh-dr-result'), '');});
    $('bh-dr-done').addEventListener('click', useCode);
    $('bh-dr-close').addEventListener('click', closeDrawer);
    $('bh-tool').addEventListener('click', () => {
      let toolCode = '';
      openDrawer({ tool: true, title: 'Code tool', get: () => toolCode, set: (hex) => {toolCode = hex;} });
    });
    hb.addEventListener('learn', (event) => onLearnEvent(event.data));
    bindSettings();
  }

  boot();
})();
