# Testing BroadLink Hub

Four stages, from no hardware to the real bridge. Each stage catches things the previous one can't.

## 1. Automated (no hardware)

```sh
npm run lint && npm test          # protocol (vs python-broadlink vectors), device behaviour,
                                  # settings backend, state-file compatibility, legacy suite
npm run test:e2e -- <storage-dir> --bench
```

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
