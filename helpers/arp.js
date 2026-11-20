'use strict';

// "pingUseArp": treat a host as on when the kernel ARP table has a complete
// entry for it. Reads /proc/net/arp on Linux, falls back to `arp -n`.
const fs = require('fs');
const { execFile } = require('child_process');

const MAC = /([0-9a-f]{2}[:-]){5}[0-9a-f]{2}/i;

const lookup = (ip) => new Promise((resolve) => {
  fs.readFile('/proc/net/arp', 'utf8', (err, text) => {
    if (!err) {
      const line = text.split('\n').find((l) => l.split(/\s+/)[0] === ip);
      const cols = line ? line.split(/\s+/) : [];
      // flags 0x2 = complete; 00:00:00:00:00:00 = incomplete
      return resolve(Boolean(line) && cols[2] !== '0x0' && MAC.test(cols[3]) && cols[3] !== '00:00:00:00:00:00');
    }
    execFile('arp', ['-n', ip], { timeout: 3000 }, (e, out) => resolve(!e && MAC.test(out)));
  });
});

const arpIPAddress = (ipAddress, interval, callback) => {
  const timer = setInterval(async () => callback(await lookup(ipAddress)), interval * 1000);
  timer.unref();
  return timer;
};

arpIPAddress.lookup = lookup;
module.exports = arpIPAddress;
