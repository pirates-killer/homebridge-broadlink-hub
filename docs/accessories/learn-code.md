# Learn switches <span class="badge adv">advanced</span>

The original way to learn codes: switches in the Home app that put the BroadLink into learning mode, with the learned code printed in the Homebridge log. The [settings page](guide/learning-codes.md) is easier (live guidance, test button, no log reading), so new setups hide these switches (`hideLearnButton`, `hideScanFrequencyButton`).

## The automatic switches

Unless hidden, the plugin adds two switches when no `learn-code` accessory is configured:

| Switch | Does |
| --- | --- |
| **Learn** | IR learning for 10 seconds. Press a remote button; the code appears in the log as `[RESULT] Learn Code (learned hex code: …)`. |
| **Scan Frequency** | RF learning (Pro models): hold the button until the frequency is found, then press briefly. Times out after 60 seconds. |

## Configuring your own

`"type": "learn-code"` (alias `learn-ir`) gives you control, for example one learn switch per BroadLink:

```json
{ "name": "Learn (Bedroom)", "type": "learn-code", "host": "192.168.1.51" },
{ "name": "Learn RF (Garage)", "type": "learn-code", "host": "192.168.1.52", "scanFrequency": true }
```

| Option | Default | Description |
| --- | --- | --- |
| `host` | first device | BroadLink to learn with. |
| `scanFrequency` | `false` | RF learning instead of IR (alias `scanRF`). |
| `disableAutomaticOff` | `false` | Keep learning until you turn the switch off, instead of stopping after the timeout. |

When any `learn-code` accessory is configured, the automatic switches aren't added.
