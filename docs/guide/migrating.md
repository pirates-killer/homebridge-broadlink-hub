# Coming from homebridge-broadlink-rm <span class="badge user">everyone</span>

BroadLink Hub is a drop-in successor to `homebridge-broadlink-rm` and `homebridge-broadlink-rm-pro` (kiwi-cam's fork, last release 4.4.21). That plugin is no longer maintained by its author.

## What stays the same

| | |
| --- | --- |
| **Your config** | Used as-is. Same `"platform": "BroadlinkRM"` block, same options, same codes. |
| **Your Home app setup** | Homebridge derives each accessory's identity from the platform name and the accessory's name. Both are unchanged, so rooms, favourites, scenes and automations stay. Verified identical with Homebridge 2.5. |
| **TV pairings** | TVs and receivers keep their identity too. No re-adding. |
| **Saved state** | AC modes, fan speeds, switch states are read from the same folder (`plugin-persist/homebridge-broadlink-rm` in the Homebridge storage folder, same file format). |
| **Child bridge** | A `_bridge` block in the platform config keeps working with the same username, so the child bridge doesn't need re-pairing. |

## Switching over

1. **Back up** (optional but wise): in the Homebridge UI, **⋮ (top right) → Backup**, or copy `config.json` and the `persist` folder.
2. **Uninstall** `homebridge-broadlink-rm` / `homebridge-broadlink-rm-pro`. Both plugins register the `BroadlinkRM` platform, so only one may be installed.
3. **Install** BroadLink Hub ([Install](guide/install.md)).
4. **Restart** Homebridge. Check the log for `BroadLink Hub 0.x.x` and `Discovered RM4 Pro (…) at …`.
5. Open the Home app: everything should be where it was.

Rolling back is the reverse: uninstall BroadLink Hub, reinstall the old plugin. Config and state are shared, so there's nothing to restore.

## What you get

- **Fixes**: commands work again after the BroadLink reboots; AC mode changes are ~300 ms faster; AC temperature reads no longer hang on devices without a sensor; no Homebridge 2 warnings.
- **The settings page**: find devices, learn and test codes, edit accessories.
- **Reliability**: every command waits for the BroadLink's acknowledgement and failures are logged.
- **Discovery that works on more networks** (subnet sweep), plus real device type and MAC detection for `hosts` entries.

## Differences to know about

| Old behaviour | Now |
| --- | --- |
| Codes were fire-and-forget. | Each code waits for the device to acknowledge it (typically 10–30 ms). A code that isn't acknowledged is logged as `not acknowledged`. |
| After a BroadLink reboot, commands silently failed until Homebridge restarted. | The plugin logs back in automatically, in the background. |
| The GitHub update check ran at every start. | Removed; the Homebridge UI shows updates. |
| `isRM4` / `isRFSupported` in `hosts` decided the device type. | The device is asked for its real type; the flags are only a fallback if it doesn't answer. |
| `hideWelcomeMessage` hid a long banner. | There's only a one-line version message now; the option is accepted and ignored. |
| Node 7.6+ "supported". | Node 20.18+ (Homebridge 2 needs 22.12+). |

## Old options that still work

All accessory options keep their meaning, including the legacy aliases: `resendHexAfterReload` (= `resendDataAfterReload`), `preventResendHex` (opposite of `allowResend`), `disableAutomaticOff` / `disableAutomaticOn`, `autoSwitch` (= `autoSwitchName`), `sendOnWhenOff` (= `turnOnWhenOff`) and `autoMinimumDuration` (= `minimumAutoOnOffDuration`).
