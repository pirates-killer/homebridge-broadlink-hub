# Light <span class="badge adv">advanced</span>

`"type": "light"`. A light bulb tile with on/off, a brightness slider and (optionally) a colour picker.

## Codes

| Key | Description |
| --- | --- |
| `on` | Sent when the light turns on. |
| `off` | Sent when it turns off. |
| `brightnessNN` | Brightness steps, for example `brightness25`, `brightness50`, `brightness100`. The slider sends the closest one. |
| `hueNN` | Colours by hue angle 0–359, for example `hue0` (red), `hue120` (green), `hue240` (blue). Adding any `hue` code shows a colour picker. |
| `white` | Sent when the colour picker's saturation goes to white. |

## Options

| Option | Default | Description |
| --- | --- | --- |
| `defaultBrightness` | `100` | Brightness set when the light turns on. |
| `useLastKnownBrightness` | `false` | Turn on at the last brightness instead of `defaultBrightness`. |
| `onDelay` | `0.1` | Seconds between the on code and the brightness / colour code. Raise it if the light needs time to wake up. |
| `exclusives` | — | Names of other `light` accessories that turn off when this one turns on (for example several colour scenes of one strip). |
| auto on/off, ping | | Same as [switch](accessories/switch.md?id=options). |

## Example: dimmable LED strip

```json
{
  "name": "Desk Lamp", "type": "light", "defaultBrightness": 60, "useLastKnownBrightness": true,
  "data": {
    "on": "2600…", "off": "2600…",
    "brightness20": "2600…", "brightness60": "2600…", "brightness100": "2600…",
    "hue0": "2600…red…", "hue120": "2600…green…", "hue240": "2600…blue…", "white": "2600…"
  }
}
```

?> Most cheap IR LED controllers only have *brighter* / *dimmer* buttons, not absolute levels. For those, use two [stateless switches](accessories/switch.md?id=examples) instead.
