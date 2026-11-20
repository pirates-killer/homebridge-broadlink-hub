'use strict';

// Tiny stand-ins for the runtime use of chai's assert and find-key, so the
// plugin no longer ships a test library and a one-function package to users.

const nodeAssert = require('assert');

const assert = (value, message) => nodeAssert(value, message);
Object.assign(assert, {
  isAbove: (v, above, msg) => nodeAssert(v > above, msg),
  isBelow: (v, below, msg) => nodeAssert(v < below, msg),
  isNumber: (v, msg) => nodeAssert(typeof v === 'number' && !Number.isNaN(v), msg),
  oneOf: (v, list, msg) => nodeAssert(list.includes(v), msg),
  isArray: (v, msg) => nodeAssert(Array.isArray(v), msg),
  isObject: (v, msg) => nodeAssert(v !== null && typeof v === 'object', msg),
});

/** Same semantics as find-key 2.x: all distinct values stored under `requiredKey`, recursively. */
const findKey = (obj, requiredKey, results = []) => {
  if (typeof obj !== 'object' || obj === null || typeof requiredKey !== 'string') {return obj === null ? results : undefined;}
  for (const key in obj) {
    const value = obj[key];
    if (key === requiredKey && !results.includes(value)) {results.push(value);}
    if (typeof value === 'object' && value !== null) {findKey(value, requiredKey, results);}
  }
  return results;
};

module.exports = { assert, findKey };
