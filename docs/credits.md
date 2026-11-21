# Special thanks & credits

BroadLink Hub stands on the work of many people. Thank you all.

## The plugin it grew from

| Project | Thanks for |
| --- | --- |
| [homebridge-broadlink-rm](https://github.com/lprhodes/homebridge-broadlink-rm) by **Luke Rhodes ([@lprhodes](https://github.com/lprhodes))** | Creating the original plugin: the accessory types, config format and much of the accessory code still used here. |
| [homebridge-broadlink-rm (fork)](https://github.com/kiwi-cam/homebridge-broadlink-rm) by **Cameron McConnochie ([@kiwi-cam](https://github.com/kiwi-cam))** | More than seven years of maintaining and extending it (RM4 support among many additions), and the [documentation site](https://broadlink.kiwicam.nz) that inspired the structure of these docs. |
| **[@Cloudore](https://github.com/Cloudore)**, **[@Faisalthe01](https://github.com/Faisalthe01)** and [every contributor](https://github.com/kiwi-cam/homebridge-broadlink-rm/graphs/contributors) to homebridge-broadlink-rm | Fixes, features and support over the years. |
| [homebridge-rm-mini3](https://github.com/tattn/homebridge-rm-mini3) by **[@tattn](https://github.com/tattn)** | Credited by the original plugin for helping get it started. |
| [homebridge-thermostat](https://github.com/PJCzx/homebridge-thermostat) by **[@PJCzx](https://github.com/PJCzx)** | Credited by the original plugin for helping get it started. |
| [broadlinkjs](https://github.com/momodalo/broadlinkjs) by **[@momodalo](https://github.com/momodalo)** | An early JavaScript BroadLink client, credited by the original plugin for helping get it started. |
| [broadlinkjs-rm](https://github.com/kiwi-cam/broadlinkjs-rm) by **@kiwi-cam** | The client library this plugin used before `lib/broadlink`; its method and event names are kept so the accessories work unchanged. |

## Protocol knowledge

| Project | Thanks for |
| --- | --- |
| [python-broadlink](https://github.com/mjg59/python-broadlink) by **Matthew Garrett ([@mjg59](https://github.com/mjg59))** and contributors (MIT) | The best-documented BroadLink implementation. Our device table is cross-checked against it, and our packets are tested byte-for-byte against vectors generated with it. No code from it is included. |
| The **BroadLink** app and devices | Studying how the official app talks to its devices (one request at a time, reply timeouts, send count) shaped our timing and reliability behaviour, for interoperability. |
| [LIRC](https://www.lirc.org) | The pulse-timing model behind the Pronto → BroadLink conversion. |

## Platform and libraries

| Project | Used for | Licence |
| --- | --- | --- |
| [Homebridge](https://github.com/homebridge/homebridge), originally by **Nick Farina ([@nfarina](https://github.com/nfarina))**, and the Homebridge team | The platform this plugin runs on; the external-accessory helper is adapted from its server code. | Apache-2.0 |
| [HAP-NodeJS](https://github.com/homebridge/HAP-NodeJS) | HomeKit accessory protocol. | Apache-2.0 |
| [Homebridge UI](https://github.com/homebridge/homebridge-config-ui-x) (homebridge-config-ui-x) and [plugin-ui-utils](https://github.com/homebridge/plugin-ui-utils) | The settings page runs inside it and talks to its backend through it. | MIT |
| [fakegato-history](https://github.com/simont77/fakegato-history) by **[@simont77](https://github.com/simont77)** | Eve app history for temperature and humidity. | MIT |
| [MQTT.js](https://github.com/mqttjs/MQTT.js) | Temperature and humidity from MQTT. | MIT |
| [Node.js](https://nodejs.org) | Runtime, and the standard library that replaced most dependencies. | MIT |

## Development and testing tools

| Tool | Used for |
| --- | --- |
| [Mocha](https://mochajs.org) and [Chai](https://www.chaijs.com) | Test runner and assertions. |
| [ESLint](https://eslint.org), [globals](https://github.com/sindresorhus/globals), [eslint-plugin-no-autofix](https://github.com/aladdin-add/eslint-plugin) | Linting. |
| [GitHub Actions](https://github.com/features/actions) | CI on Node 20–26 and npm publishing. |
| [Homebridge Raspberry Pi image](https://github.com/homebridge/homebridge-raspbian-image) | The real-hardware test bridge. |
| [androguard](https://github.com/androguard/androguard) (Apache-2.0) | Reading the official BroadLink app's Java code to learn its control timing. |
| [REA](https://github.com/morluto/rea) by **[@morluto](https://github.com/morluto)** (MIT) | Inspecting the BroadLink app package. |
| [python-qrcode](https://github.com/lincolnloop/python-qrcode) and [PyPNG](https://gitlab.com/drj11/pypng) | Pairing QR codes for the test bridge. |
| [Claude Code](https://claude.com/claude-code) by [Anthropic](https://www.anthropic.com) | AI pair programmer for the rewrite, tests, settings page, these docs and the screenshots. |
| Google Chrome with Claude in Chrome | Driving the Homebridge UI to test the settings page and capture the screenshots in these docs. |

## Documentation

| Project | Used for | Licence |
| --- | --- | --- |
| [docsify](https://docsify.js.org) and its search and zoom-image plugins | This site. | MIT |
| [docsify-copy-code](https://github.com/jperasmus/docsify-copy-code) by **[@jperasmus](https://github.com/jperasmus)** | Copy buttons on code blocks. | MIT |
| [Prism](https://prismjs.com) | Syntax highlighting. | MIT |
| [jsDelivr](https://www.jsdelivr.com) | Serving the docsify assets. | — |

## Projects referenced in these docs

[Home Assistant](https://www.home-assistant.io/integrations/broadlink/) and [SmartIR](https://github.com/smartHomeHub/SmartIR) (base64 code format and code libraries), [irdb](https://github.com/probonopd/irdb) and [Remote Central](https://www.remotecentral.com) (Pronto code collections), [Zigbee2MQTT](https://www.zigbee2mqtt.io) (MQTT payload example) and the [Eve app](https://www.evehome.com/en/eve-app) (history graphs).

## Trademarks

BroadLink is a trademark of Hangzhou BroadLink Technology Co., Ltd. Apple, HomeKit, Siri and Apple TV are trademarks of Apple Inc. Eve is a trademark of Eve Systems GmbH. This project is independent and not affiliated with or endorsed by any of them.

## Licence

BroadLink Hub is licensed under the [Apache License 2.0](https://github.com/pirates-killer/homebridge-broadlink-hub/blob/main/LICENSE). It contains code derived from homebridge-broadlink-rm (Apache-2.0); see [NOTICE](https://github.com/pirates-killer/homebridge-broadlink-hub/blob/main/NOTICE).

?> Missed someone? Please [open an issue](https://github.com/pirates-killer/homebridge-broadlink-hub/issues) and we'll add them.
