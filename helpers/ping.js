'use strict';

// Reachability check for "pingIPAddress". Uses the system ping binary directly
// (the old `ping` npm package did the same, with more overhead).
const { execFile } = require('child_process');

const probe = (ip) => new Promise((resolve) => {
  const args = process.platform === 'win32' ? ['-n', '1', '-w', '1000', ip]
    : process.platform === 'darwin' ? ['-c', '1', '-t', '1', ip]
      : ['-c', '1', '-W', '1', ip];
  execFile('ping', args, { timeout: 3000, windowsHide: true }, (err) => resolve(!err));
});

const pingIPAddress = (ipAddress, interval, callback) => {
  let busy = false;
  const timer = setInterval(async () => {
    if (busy) {return;}
    busy = true;
    try {callback(await probe(ipAddress));} finally {busy = false;}
  }, interval * 1000);
  timer.unref();
  return timer;
};

pingIPAddress.probe = probe;
module.exports = pingIPAddress;
