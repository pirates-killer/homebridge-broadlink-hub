# Testing <span class="badge dev">developer</span>

Four stages, from no hardware to the real bridge. Each stage catches things the previous one can't.

## 1. Automated (no hardware)

```sh
npm run lint && npm test          # protocol (vs python-broadlink vectors), device behaviour,
                                  # settings backend, state-file compatibility, legacy suite
npm run test:e2e -- <storage-dir> --bench
```

| Suite | Covers |
| --- | --- |
| `test/protocol.test.js` | Packet codec against python-broadlink vectors; RMDevice against the simulator: acknowledgements, re-login after reboot, no double send, retries with the same counter, ordering, `sendGap`, stale-reply rejection, adaptive timeout, keepalive, hostnames, startup queueing, probe resends |
| `test/ui-server.test.js` | The settings backend driven over IPC like the Homebridge UI does: probe, scan, code conversion, test send, IR and RF learning with events, cancel |
| `test/persistence.test.js` | State files written by node-persist 2 (the old plugin) read and written back in the same format |
| `test/package.test.js` | Packs the plugin like `npm publish`, unpacks it alone, loads it, and checks every relative import targets a shipped file |
| legacy suites | Accessory behaviour inherited from homebridge-broadlink-rm (tests that also fail on its last release are listed in `test/known-legacy-failures.js` and skipped) |

The RM simulator (`test/sim/rmSimulator.js`) answers like a real RM over UDP and has knobs for failure modes: `dropNext` (request lost), `muteNext` (reply lost after executing), `replyDelay`, `reboot()` (session lost → −7), `locked`, `dropHellos`, `learnDelay` / `frequencyDelay` (simulated button presses), `sensor`. Run it standalone with `node test/sim/rmSimulator.js 47123`.

`test:e2e` boots real Homebridge with the `config.json` in `<storage-dir>` against the RM simulator. The config's first `hosts` entry must point at `127.0.0.1:<port>`, and the bridge should be bound to `lo`. It drives switches, fan, AC and TV over HAP, power-cycles the simulated RM, fails on any Homebridge/HAP warning, and with `--bench` prints tap-to-code latency.

## 2. Settings page in a browser

```sh
node test/ui-preview/serve.js [config.json]          # simulator: safe, nothing is transmitted
node test/ui-preview/serve.js config.json --real     # your real BroadLink devices
```

Open http://127.0.0.1:8581/. With `--real`, **Learn** captures from your real remote, and **Test** sends real IR/RF, so devices in the room react. Edits stay in memory (see `GET /api/config`) and never touch Homebridge.

Check:
- [ ] **Find devices** lists your RM (and marks it added)
- [ ] **Learn IR**: the prompt appears, you press the remote, "Got it" appears, and **Test** makes the device react
- [ ] **Learn RF** (Pro models): hold → "Signal found … MHz" → short press → code
- [ ] Paste a base64 code (Home Assistant / SmartIR), **Use this code**, and it is stored as hex
- [ ] Edit an accessory, then **Save accessory**: only the changed key differs in `/api/config`

## 3. Test bridge next to your current one

Run a second, isolated Homebridge with this plugin and a few renamed copies of your accessories ("Test Living Room Light"…), on its own port and bridge ID. It shares the RM with your real bridge: BroadLink devices accept several sessions. Pair it in the Home app (from a phone on the same network segment as the bridge, for mDNS).

Field checklist (a day of normal use):
- [ ] Taps feel instant; nothing fires twice
- [ ] Siri and scenes with several accessories: every code arrives, in order
- [ ] AC: off → cool → temperature up/down → heat → off; temperature shows (sensor RMs)
- [ ] TV: power, inputs, Control Centre remote keys, volume
- [ ] Unplug the RM for a minute and plug it back in: the next tap works without restarting Homebridge
- [ ] Restart the test bridge: accessories keep their state and stay paired
- [ ] Logs: no errors, no "not acknowledged"

## 4. Swap on the main bridge

The plugin registers the same `BroadlinkRM` platform name as homebridge-broadlink-rm, so it replaces it in place:

1. Back up `config.json` and `persist/`.
2. Uninstall homebridge-broadlink-rm(-pro), then install homebridge-broadlink-hub. Keep your config.
3. Restart. All accessories should still be in their rooms, with automations intact.

Roll back by reinstalling the previous plugin. The config and saved state are shared, so nothing needs restoring.
