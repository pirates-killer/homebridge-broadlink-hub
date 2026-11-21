# Several BroadLinks, child bridges <span class="badge adv">advanced</span>

## More than one BroadLink

Common in larger homes: one RM per room, because IR needs line of sight.

1. Add every device on the settings page (or list them under `hosts`).
2. Set each accessory's **BroadLink device** (`host`) to the RM in that room.

```json
"hosts": [
  { "address": "192.168.1.50", "mac": "34:ea:34:12:ab:cd" },
  { "address": "192.168.1.51", "mac": "34:ea:34:98:76:54" }
],
"accessories": [
  { "name": "Living Room TV", "type": "tv", "host": "192.168.1.50", "data": { … } },
  { "name": "Bedroom AC", "type": "air-conditioner", "host": "34:ea:34:98:76:54", "data": { … } }
]
```

`host` accepts the IP address or the MAC. Accessories without `host` use the first BroadLink found, which is fine with one device but unpredictable with several.

Each BroadLink has its own queue, so a slow or offline device never delays codes going to another.

## Learn switches per device

If you still use the Home app's Learn switches with several devices, add one per BroadLink with a `host`:

```json
{ "name": "Learn (Living Room)", "type": "learn-code", "host": "192.168.1.50" },
{ "name": "Learn (Bedroom)", "type": "learn-code", "host": "192.168.1.51", "scanFrequency": true }
```

The settings page is easier: pick the device under **Learn / test with**.

## Discovery vs. hosts

| | Automatic discovery (no `hosts`) | `hosts` listed |
| --- | --- | --- |
| Startup | Broadcasts for `deviceDiscoveryTimeout` seconds (default 60) plus a one-off subnet sweep | Asks only the listed devices |
| Networks that drop broadcasts | Found by the sweep (same /22 or smaller subnet only) | Always works |
| Device changes IP | Found again automatically (use MACs as `host`) | Update the address (or give it a DHCP reservation) |
| Devices on another subnet / VLAN | Not found | Works if routed |

## Running as a child bridge

A child bridge runs the plugin in its own Homebridge process with its own pairing. Turn it on in **Plugins → BroadLink Hub → ⋮ → Bridge Settings**, or add a `_bridge` block:

```json
{
  "platform": "BroadlinkRM",
  "name": "BroadLink Hub",
  "_bridge": { "username": "0E:12:34:56:78:9A", "port": 51830 },
  "hosts": [ … ],
  "accessories": [ … ]
}
```

Benefits: a problem in one plugin can't take down the others, and restarts are quicker. The child bridge is paired once in the Home app with the same PIN.

## Several Homebridge instances

Two Homebridge instances can share a BroadLink: it hands every client the same session, so they don't disturb each other. Give each instance its own bridge `username` and `port`, and don't let both control the same accessory.
