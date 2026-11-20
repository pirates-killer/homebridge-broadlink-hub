'use strict';

// Known BroadLink device types (u16 at offset 0x34 of the hello reply).
// Union of the upstream kiwicam table and python-broadlink 0.19's RM classes.
// Families decide framing and capabilities:
//   rm   - RM2/RM3, IR only, legacy framing
//   rmp  - RM2/RM3 Pro, IR + RF, legacy framing
//   rm4  - RM4 / RM mini 3 (newer fw), IR only, length-prefixed framing
//   rm4p - RM4 Pro, IR + RF, length-prefixed framing

const table = {
  rm: {
    0x2737: 'RM3 Mini', 0x27d0: 'RM3 Mini', 0x27c7: 'RM3 Mini A',
    0x27c2: 'RM3 Mini B', 0x27de: 'RM3 Mini C', 0x27d3: 'RM3 Mini KR',
    0x278f: 'RM Mini Shate', 0x27b7: 'RM3 Mini', 0x27cc: 'RM3 Mini', 0x27cd: 'RM3 Mini',
    0x27d1: 'RM3 Mini', 0x27dc: 'RM3 Mini', 0x2221: 'Manual RM Device',
  },
  rmp: {
    // 0x2712/0x273d/0x2783/0x277c were IR-only upstream; python-broadlink
    // classes them as RM pro (RF capable), which we follow.
    0x2712: 'RM2 / RM Pro', 0x273d: 'RM Pro Phicomm', 0x2783: 'RM2 Home Plus',
    0x277c: 'RM2 Home Plus GDT', 0x272a: 'RM2 Pro Plus', 0x2787: 'RM2 Pro Plus v2', 0x278b: 'RM2 Pro Plus BL',
    0x2797: 'RM2 Pro Plus HYC', 0x27a1: 'RM2 Pro Plus R1', 0x27a6: 'RM2 Pro PP',
    0x279d: 'RM3 Pro Plus', 0x27a9: 'RM3 Pro Plus v2', 0x27c3: 'RM3 Pro',
    0x2223: 'Manual RM Pro Device',
  },
  rm4: {
    // Newer RM mini 3 firmware speaks RM4 framing (upstream special-cased these).
    0x5f36: 'RM3 Mini B', 0x6507: 'RM3 Mini', 0x6508: 'RM3 Mini D',
    0x5209: 'RM4 TV mate', 0x5211: 'RM4C mate', 0x5212: 'RM4 TV mate', 0x521c: 'RM4 Mini',
    0x6364: 'RM4S',
    0x51da: 'RM4 Mini', 0x610e: 'RM4 Mini', 0x62bc: 'RM4 Mini', 0x653a: 'RM4 Mini',
    0x5216: 'RM4 Mini', 0x520c: 'RM4 Mini', 0x6070: 'RM4 Mini C', 0x62be: 'RM4 Mini C',
    0x610f: 'RM4 Mini C', 0x6539: 'RM4 Mini C', 0x520d: 'RM4 Mini C', 0x648d: 'RM4 Mini S',
    0x2225: 'Manual RM4 Device',
  },
  rm4p: {
    0x5213: 'RM4 Pro', 0x6026: 'RM4 Pro', 0x61a2: 'RM4 Pro', 0x649b: 'RM4 Pro',
    0x653c: 'RM4 Pro', 0x520b: 'RM4 Pro', 0x6184: 'RM4C Pro', 0x5218: 'RM4C Pro',
    0x2227: 'Manual RM4 Pro Device',
  },
};

const lookup = (devtype) => {
  for (const family of Object.keys(table)) {
    if (table[family][devtype]) {
      return {
        family,
        model: table[family][devtype],
        rm4: family === 'rm4' || family === 'rm4p',
        rf: family === 'rmp' || family === 'rm4p',
      };
    }
  }
  return null;
};

/** Synthetic type for hand-configured hosts that never answer hello. */
const manualType = ({ isRFSupported, isRM4 }) => {
  if (isRM4) {
    // RM4 Pro firmware rejects requests whose devtype isn't a real one, so the
    // synthetic 0x2227 is never accepted; 0x520b is.
    return isRFSupported ? 0x520b : 0x2225;
  }
  return isRFSupported ? 0x2223 : 0x2221;
};

module.exports = { table, lookup, manualType };
