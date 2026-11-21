# Settings page internals <span class="badge dev">developer</span>

The settings page is a Homebridge UI **custom plugin UI** (`config.schema.json` has `"customUi": true`). It has two halves:

| | File | Runs in |
| --- | --- | --- |
| Backend | `homebridge-ui/server.js` (ESM, via `homebridge-ui/package.json`) | A child process the Homebridge UI starts when the settings window opens (never inside the bridge) |
| Page | `homebridge-ui/public/index.html`, `app.js` | An iframe in the Homebridge UI, talking to the backend through `window.homebridge` |

The backend uses `lib/broadlink` with its **own** BroadLink session, so it works while the bridge is running (the device shares sessions between clients).

## Backend endpoints

Called from the page with `homebridge.request(path, body)`:

| Path | Body | Returns |
| --- | --- | --- |
| `/scan` | `{ sweep = true, timeoutMs = 2500, port, broadcast }` | `{ ok, devices: [describe()] }` |
| `/probe` | `{ address, port }` | `{ ok, device }` or `{ ok: false, error }` |
| `/convert` | `{ text }` | `{ ok, hex, format: 'hex' \| 'base64' \| 'pronto' }` |
| `/send` | `{ host, code }` | `{ ok, ms }` (sends once) |
| `/learn/start` | `{ host, kind: 'ir' \| 'rf' }` | `{ ok, model }`; progress via push events |
| `/learn/cancel` | — | `{ ok }` |

`host` is a `hosts` entry (`{ address, port, mac, isRM4, isRFSupported }`) or an address string.

### Learning events

`/learn/start` returns immediately; progress arrives as `learn` push events (`homebridge.addEventListener('learn', e => e.data)`):

| `stage` | Extra fields | Meaning |
| --- | --- | --- |
| `ready` | `message` | IR: waiting for the button press |
| `sweeping` | `message` | RF: hold the button |
| `frequency` | `mhz` | RF: frequency found, release |
| `press` | `message` | RF: press briefly |
| `code` | `hex`, (`mhz`) | Done |
| `timeout`, `cancelled`, `error` | `message` | Ended without a code |

## Config handling in the page

The page owns the whole platform block. Every change is a read-modify-write of the live config followed by `homebridge.updatePluginConfig()`; the Homebridge UI writes it to disk when the user presses **Save**. Accessories are edited as copies; only **Save accessory** writes them back, and keys the form doesn't know are preserved. The JSON tab edits the same object.

The schema-generated form is never shown, because a JSON-schema form can drop properties it doesn't describe, and accessory configs contain free-form code maps.

## Accessory forms

`app.js` defines each form declaratively in `TYPES` with field helpers: `code(path, label)`, `num(path, label)`, `bool(path, label)`, `choice(path, label, options)`, `section(label)`, plus three special editors (`fanSpeeds`, `tvInputs`, `acGrid`). Codes stored as `{ data, … }` objects (AC `pseudo-mode`) are edited in place, keeping the extra keys.

Adding a form for another type means adding an entry to `TYPES`; types without one fall back to the JSON tab.

## Previewing outside Homebridge

```bash
node test/ui-preview/serve.js [config.json]          # page + real backend + RM simulator
node test/ui-preview/serve.js config.json --real     # against the devices in the config
```

The preview serves the page with a stand-in `window.homebridge` that forwards requests to the real backend, so everything except the Homebridge chrome around it is the production code.
