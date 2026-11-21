# Contributing & releasing <span class="badge dev">developer</span>

## Getting started

```bash
git clone https://github.com/pirates-killer/homebridge-broadlink-hub.git
cd homebridge-broadlink-hub
npm ci
npm run lint && npm test
```

Node 20.18+ is required; CI runs on Node 20, 22, 24 and 26.

## Ground rules

- **Never break existing configs.** Option names, defaults and accessory identities (`BroadlinkRM` + accessory name) are part of the contract. Add aliases rather than renaming.
- **HomeKit callbacks never wait on the network.** Accessories update state and call back immediately; sends happen behind.
- **No blind resends of control codes.** A lost reply must never make a toggle fire twice (see `retries`).
- **Runtime dependencies are a cost.** Prefer Node's standard library; load optional dependencies lazily.
- **Tests with the change.** Protocol changes get a simulator test, accessory changes a test on real HAP services or an e2e check, UI backend changes a `test/ui-server.test.js` case.

## Adding a device type

If a new RM model shows up as `Ignoring unknown Broadlink device type 0x…`, add it to `lib/broadlink/deviceTypes.js` in the right family (`rm`, `rmp`, `rm4`, `rm4p`). If it's in python-broadlink, use its classification.

## Adding an accessory type

1. Create `accessories/<type>.js`, usually extending `BroadlinkRMAccessory` (`accessories/accessory.js`) or an existing type.
2. Implement `setDefaults()` for option defaults and `setupServiceManager()` to create the HomeKit service and bind characteristics with `serviceManager.addToggleCharacteristic(...)`, using `onData` / `offData` or a `setValuePromise`.
3. Register it in `accessories/index.js` and the `classTypes` map in `platform.js`.
4. Optionally add a form in `homebridge-ui/public/app.js` (`TYPES`).
5. Document it in `docs/accessories/` and add it to the sidebar and the overview table.

## Documentation

This site is [docsify](https://docsify.js.org): plain Markdown in `docs/`, rendered in the browser. Preview it locally:

```bash
npx --yes serve docs        # or: python3 -m http.server -d docs 3000
```

Screenshots in `docs/images/` are taken from the real Homebridge UI against the RM simulator with a demo config (generic names, made-up MAC), so no personal data ends up in the docs.

## Releasing

1. Bump `version` in `package.json` and add its `CHANGELOG.md` section.
2. Merge to `main` (CI must be green).
3. On GitHub, publish a release with tag `v<version>` (target `main`) and paste that `CHANGELOG.md` section as the notes. The Homebridge UI shows these notes in its update dialog.
4. The `publish` workflow checks the tag matches `package.json`, then publishes to npm with provenance via npm Trusted Publishing (no token or 2FA prompt). A version that is already on npm is skipped.

One-time setup: on npmjs.com, open the package → Settings → Trusted Publisher → GitHub Actions, and enter this repository and the workflow file `publish.yml`.

## Licence

Apache-2.0. The project is derived from homebridge-broadlink-rm; keep `NOTICE` up to date when you add third-party material.
