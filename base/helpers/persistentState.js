'use strict';

// Accessory state store. On-disk format is identical to node-persist 2.x
// (which earlier versions used): one file per key, named md5(key), holding
// {"key": ..., "value": ...}. Existing state therefore carries over.
// Writes are coalesced so rapid characteristic changes don't hammer the disk.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let dir = null;
const cache = new Map();
const dirty = new Set();
let flushTimer = null;

const md5 = (s) => crypto.createHash('md5').update(s).digest('hex');
const keyFor = ({ host, name }) => `${host || 'default'}-${name}`;

const flush = () => {
  clearTimeout(flushTimer);
  flushTimer = null;
  for (const key of dirty) {
    const file = path.join(dir, md5(key));
    try {
      if (cache.get(key) === undefined) {
        fs.rmSync(file, { force: true });
      } else {
        fs.writeFileSync(`${file}.tmp`, JSON.stringify({ key, value: cache.get(key) }));
        fs.renameSync(`${file}.tmp`, file);
      }
    } catch { /* best effort; next change retries */ }
  }
  dirty.clear();
};

const schedule = (key) => {
  dirty.add(key);
  if (!flushTimer) {
    flushTimer = setTimeout(flush, 250);
    flushTimer.unref();
  }
};

const init = ({ homebridgeDirectory, homebridge }) => {
  if (!homebridgeDirectory) {homebridgeDirectory = homebridge.user.storagePath();}
  // Same folder as homebridge-broadlink-rm, so state survives switching plugins.
  dir = path.join(homebridgeDirectory, 'plugin-persist', 'homebridge-broadlink-rm');
  fs.mkdirSync(dir, { recursive: true });
};

const load = (id) => {
  const key = keyFor(id);
  if (cache.has(key)) {return cache.get(key);}
  let value;
  try {
    value = JSON.parse(fs.readFileSync(path.join(dir, md5(key)), 'utf8')).value;
  } catch { /* missing or corrupt: start fresh (node-persist forgiveParseErrors) */ }
  cache.set(key, value);
  return value;
};

const save = ({ host, name, state }) => {
  const key = keyFor({ host, name });
  cache.set(key, state);
  schedule(key);
};

const clear = ({ host, name }) => {
  const key = keyFor({ host, name });
  cache.set(key, undefined);
  schedule(key);
};

process.on('exit', () => {if (dir && dirty.size) {flush();}});

module.exports = { init, clear, load, save, flush };
