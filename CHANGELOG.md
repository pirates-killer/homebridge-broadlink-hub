# Changelog

All notable changes to this project are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project uses [Semantic Versioning](https://semver.org/).

## [0.1.0] - unreleased

First release of BroadLink Hub, the successor to homebridge-broadlink-rm 4.4.21 (whose history is summarised below).

### Added
- Documentation site (`docs/`, docsify, ready for GitHub Pages) for three audiences: a step-by-step guide with screenshots, a complete option reference with defaults taken from the code, and a developer section (architecture, wire protocol, library API, settings-page internals, testing, contributing).
- Settings page in the Homebridge UI: find devices (broadcast plus a subnet sweep for networks that block broadcasts), add RMs by IP, add/edit/duplicate/delete accessories, learn IR and RF codes with live guidance, test codes, and convert pasted base64 (Home Assistant / SmartIR) and Pronto codes. Every option stays editable in a JSON tab, and unknown options are preserved.
- `lib/broadlink`: standalone BroadLink RM client with discovery, scan, IR/RF learning flows and packets verified against python-broadlink.
- Automatic discovery also sweeps the local subnet once.
- 11 more RM models (RM4 TV mate, RM4C mate, RM4S, RM4C Pro, several RM mini 3s).
- `sendGap`, `retries`, `timeout`, `port` connection options.

### Changed
- Commands wait for the device's acknowledgement. Replies are matched by packet counter and checksum-validated, and the timeout adapts to the measured round trip.
- The session is kept warm: reboots are detected and re-authenticated in the background.
- Commands issued while the plugin starts are queued instead of dropped.
- Runtime dependencies reduced from 13 to 2. No GitHub update check at startup.
- Requires Node 20.18+ and Homebridge 1.8+ or 2.x.

### Fixed
- Commands stopped working after the BroadLink rebooted until Homebridge was restarted.
- Air conditioner: every mode change waited 300 ms (missing `await`), plus 250 ms before the temperature code when no separate mode code exists.
- Air conditioner: the first AUTO/COOL/HEAT tap on a fresh accessory sent nothing.
- Air conditioner / heater-cooler / humidifier: HomeKit reads hung when the RM returned no sensor reading, and `undefined` temperature/humidity values triggered Homebridge 2 warnings.
- RM4 length field, signed sensor values, hostnames for `hosts`, a TV `subType` crash, and per-host options for locked devices.
- `resendDataAfterReload` was always overwritten by the old name `resendHexAfterReload`; both names work now.
- `adaptiveTimeout` is now accepted at platform level and per `hosts` entry.
- RF learning gives 2 seconds (was 1) to release the button after the frequency is found.
- Settings page: the hint for empty off codes now says what really happens (nothing is sent; for one toggle button use the same code twice); readable type picker in the Homebridge theme.

### Compatibility
- Registers the `BroadlinkRM` platform name: existing configs work unchanged, and accessory IDs (HomeKit rooms, scenes, automations) and saved state carry over.
