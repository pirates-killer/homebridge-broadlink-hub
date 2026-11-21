# BroadLink Hub for Homebridge

Control your TV, air conditioner, fans, lights, blinds and anything else with an IR or RF remote from the Apple Home app and Siri, through a BroadLink RM (RM mini 3, RM Pro, RM4 mini, RM4 Pro and relatives).

- **Set up in the Homebridge UI.** Find your BroadLink, add accessories, and learn each code by pointing your remote at it. No JSON editing and no reading log files. You can also paste codes from Home Assistant / SmartIR (base64) or Pronto.
- **Fast.** In our tests, a tap in the Home app reaches the BroadLink in about 2 ms of plugin time. Commands wait for the device's acknowledgement, and the timeout learns your network's real round trip.
- **Reliable.** If the BroadLink reboots, the plugin logs back in before your next tap. Locked devices are reported clearly. Commands sent while Homebridge is still starting are queued instead of dropped.
- **Finds devices on tricky Wi-Fi.** When the network blocks discovery broadcasts, it asks every address on your subnet directly.
- **Drop-in successor to [homebridge-broadlink-rm](https://github.com/kiwi-cam/homebridge-broadlink-rm).** Same config, same accessories in the Home app (rooms, scenes and automations stay), same saved state.
- **Local only.** No BroadLink cloud account, two runtime dependencies, Homebridge 1.8+ and 2.x, Node 20–26.

## Install

In the Homebridge UI, search the Plugins tab for **BroadLink Hub**, or:

```sh
npm install -g homebridge-broadlink-hub
```

Then open the plugin's **Settings**:

1. **Find devices on my network**, then **Add** your RM. (Or type its IP address.)
2. **Add accessory**, then pick a type (switch, light, fan, TV, air conditioner, blind…) and name it.
3. For each code, press **Learn / paste**, then **Learn IR** (or **Learn RF** for 433/315 MHz remotes on Pro models), and press the button on your remote. Press **Test** to check it, then **Use this code**.
4. Press **Save** and restart Homebridge.

TVs appear as separate accessories: add them in the Home app with **Add Accessory** using your Homebridge PIN.

## Coming from homebridge-broadlink-rm

1. Uninstall `homebridge-broadlink-rm` / `homebridge-broadlink-rm-pro`. Both register the `BroadlinkRM` platform, so keep only one installed.
2. Install `homebridge-broadlink-hub` and restart. Your existing config is used as-is.

Accessory IDs come from the platform name and each accessory's name, so your Home app setup stays as it was. Saved accessory state (`plugin-persist/homebridge-broadlink-rm`) is read and written in the same format. Renaming an accessory still makes HomeKit treat it as new; the settings page warns you before you do.

## Supported devices

RM2, RM3 / RM mini 3 (all known variants), RM Pro / Pro+, RM4 mini, RM4C mini, RM4S, RM4 TV mate, RM4 Pro, RM4C Pro. The device list is cross-checked against [python-broadlink](https://github.com/mjg59/python-broadlink). An unknown RM can be added by IP address with "RM4 family" / "Has RF" set.

If your BroadLink is not found or refuses to connect, it is probably **locked**: in the BroadLink app, open the device, tap **…**, and turn **Lock device** off.

## Accessory types

| Type | Codes |
| --- | --- |
| `switch`, `outlet` | on, off (or one code) · auto-off, stateless |
| `light` | on, off · brightness and colour codes |
| `fan`, `fanv1` | on, off, speeds, swing, direction |
| `tv` | power, inputs, remote keys (Control Centre remote), volume |
| `air-conditioner` | off, on, one code per mode and temperature |
| `heater-cooler` | modes, temperatures, swing ([details](docs/accessories/heater-cooler.md)) |
| `garage-door-opener`, `lock`, `window-covering`, `window` | open/close/stop, lock/unlock |
| `air-purifier`, `humidifier-dehumidifier`, `temperatureSensor`, `humiditySensor`, `switch-multi`, `switch-repeat`, `switch-multi-repeat` | see the JSON tab |

Every option of homebridge-broadlink-rm works unchanged. **[Full documentation](https://pirates-killer.github.io/homebridge-broadlink-hub/)** (also in [`docs/`](docs/README.md)): a step-by-step guide with screenshots, every option with its default, and a developer reference. The settings page shows the common options as a form, and every option in each accessory's **JSON** tab.

## Connection options

Set these in **Settings** (all devices) or per entry under `hosts`:

| Option | Default | Meaning |
| --- | --- | --- |
| `sendGap` | `0` | Minimum ms between two codes sent to the same BroadLink. Raise it if a device misses codes in quick succession. |
| `retries` | `0` | Resend a code when no reply arrives. Keep `0` for power-toggle codes: if the reply was lost after the code ran, a resend would toggle the device back. |
| `timeout` | `2000` | Upper limit (ms) for waiting on a reply. The actual wait adapts to your network, usually 250 ms. |
| `port` | `80` | UDP port of the BroadLink. |

## How it compares

Measured with real Homebridge 2.5 against a simulated RM4 Pro (`npm run test:e2e -- <dir> --bench`):

| | homebridge-broadlink-rm 4.4.21 | BroadLink Hub |
| --- | --- | --- |
| Switch: tap → code sent (median / worst) | 2.2 / 12.3 ms | 1.7 / 2.6 ms |
| Air conditioner mode change | ~300 ms | ~2 ms |
| A lost reply blocks the next command for | (no replies checked) | ~250 ms |
| AC temperature read without a sensor | hangs, HomeKit "No Response" | immediate |
| After the BroadLink reboots | commands fail until Homebridge restarts | recovers automatically |

## Development

```sh
npm test                               # unit, protocol, settings-backend and legacy tests
npm run lint
node test/sim/rmSimulator.js 47123     # standalone RM simulator
node test/ui-preview/serve.js [config.json]   # settings page in a browser, backed by the simulator
npm run test:e2e -- <storage-dir>      # boots real Homebridge against the simulator
```

`lib/broadlink` is a standalone BroadLink RM client (discovery, auth, IR/RF send and learning) with packets verified byte-for-byte against python-broadlink.

## Special thanks & credits

BroadLink Hub stands on the work of many people. Thank you all. (The [full credits page](https://pirates-killer.github.io/homebridge-broadlink-hub/#/credits) says what each one contributed.)

**The plugin it grew from**
- [homebridge-broadlink-rm](https://github.com/lprhodes/homebridge-broadlink-rm) by Luke Rhodes ([@lprhodes](https://github.com/lprhodes)), who created the original plugin.
- [Its fork](https://github.com/kiwi-cam/homebridge-broadlink-rm) by Cameron McConnochie ([@kiwi-cam](https://github.com/kiwi-cam)), who maintained it for more than seven years, plus the [documentation site](https://broadlink.kiwicam.nz) that inspired ours, and [broadlinkjs-rm](https://github.com/kiwi-cam/broadlinkjs-rm).
- [@Cloudore](https://github.com/Cloudore), [@Faisalthe01](https://github.com/Faisalthe01) and [every contributor](https://github.com/kiwi-cam/homebridge-broadlink-rm/graphs/contributors) to homebridge-broadlink-rm.
- [@tattn](https://github.com/tattn) ([homebridge-rm-mini3](https://github.com/tattn/homebridge-rm-mini3)), [@PJCzx](https://github.com/PJCzx) ([homebridge-thermostat](https://github.com/PJCzx/homebridge-thermostat)) and [@momodalo](https://github.com/momodalo) ([broadlinkjs](https://github.com/momodalo/broadlinkjs)), credited by the original plugin for getting it started.

**Protocol knowledge**
- [python-broadlink](https://github.com/mjg59/python-broadlink) by Matthew Garrett ([@mjg59](https://github.com/mjg59)) and contributors: device table cross-check and byte-for-byte test vectors (no code included).
- The official **BroadLink** app, whose control timing we studied for interoperability. Also [LIRC](https://www.lirc.org) for the pulse model behind Pronto conversion.

**Platform and libraries**
- [Homebridge](https://github.com/homebridge/homebridge), originally by Nick Farina ([@nfarina](https://github.com/nfarina)), plus [HAP-NodeJS](https://github.com/homebridge/HAP-NodeJS), the [Homebridge UI](https://github.com/homebridge/homebridge-config-ui-x) and [plugin-ui-utils](https://github.com/homebridge/plugin-ui-utils) by the Homebridge team.
- [fakegato-history](https://github.com/simont77/fakegato-history) by [@simont77](https://github.com/simont77) (Eve history), [MQTT.js](https://github.com/mqttjs/MQTT.js) and [Node.js](https://nodejs.org).

**Tools we used to build and test it**
- [Mocha](https://mochajs.org), [Chai](https://www.chaijs.com), [ESLint](https://eslint.org), [globals](https://github.com/sindresorhus/globals), [eslint-plugin-no-autofix](https://github.com/aladdin-add/eslint-plugin), [GitHub Actions](https://github.com/features/actions) and the [Homebridge Raspberry Pi image](https://github.com/homebridge/homebridge-raspbian-image).
- [androguard](https://github.com/androguard/androguard) and [REA](https://github.com/morluto/rea) by [@morluto](https://github.com/morluto), for studying the BroadLink app; [python-qrcode](https://github.com/lincolnloop/python-qrcode) and [PyPNG](https://gitlab.com/drj11/pypng) for pairing QR codes.
- [Claude Code](https://claude.com/claude-code) by [Anthropic](https://www.anthropic.com), the AI pair programmer, and Google Chrome with Claude in Chrome for UI testing and the documentation screenshots.
- [docsify](https://docsify.js.org), [docsify-copy-code](https://github.com/jperasmus/docsify-copy-code), [Prism](https://prismjs.com) and [jsDelivr](https://www.jsdelivr.com) for the documentation site.

**Referenced in the docs:** [Home Assistant](https://www.home-assistant.io/integrations/broadlink/), [SmartIR](https://github.com/smartHomeHub/SmartIR), [irdb](https://github.com/probonopd/irdb), [Remote Central](https://www.remotecentral.com), [Zigbee2MQTT](https://www.zigbee2mqtt.io) and the [Eve app](https://www.evehome.com/en/eve-app).

Missed someone? Please [open an issue](https://github.com/pirates-killer/homebridge-broadlink-hub/issues).

## Trademarks

BroadLink is a trademark of Hangzhou BroadLink Technology Co., Ltd. Apple, HomeKit, Siri and Apple TV are trademarks of Apple Inc. Eve is a trademark of Eve Systems GmbH. This project is independent and not affiliated with or endorsed by any of them.

## Licence

Apache License 2.0; see [LICENSE](LICENSE). Contains code derived from homebridge-broadlink-rm (Apache-2.0); see [NOTICE](NOTICE).
