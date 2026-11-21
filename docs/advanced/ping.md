# State from ping / ARP <span class="badge adv">advanced</span>

IR and RF devices never report whether they're on. But many devices you control with IR are also on your network: smart TVs, AV receivers, game consoles, set-top boxes. If the device is reachable on the network, it's (probably) on. BroadLink Hub can watch that and keep the tile in sync, even when someone uses the original remote.

Available on **switch**, **outlet**, **fan** and **TV** accessories.

```json
{
  "name": "Living Room TV",
  "type": "tv",
  "pingIPAddress": "192.168.1.80",
  "pingFrequency": 2,
  "pingGrace": 15,
  "pingIPAddressStateOnly": true,
  "data": { … }
}
```

| Option | Default | Description |
| --- | --- | --- |
| `pingIPAddress` | — | The controlled device's IP address (not the BroadLink's). Give it a DHCP reservation. |
| `pingFrequency` | `1` | Seconds between checks. |
| `pingGrace` | `10` | After a tap, ignore ping results for this many seconds; the device needs time to boot or shut down, and would otherwise flip the tile back. |
| `pingUseArp` | `false` | Check the system ARP table instead of sending ICMP ping. Use for devices that don't answer ping. |
| `pingIPAddressStateOnly` | `false` | `true`: only update the tile. `false`: also send the on/off code when the detected state changes (rarely what you want). |

Outlets use the result for **In Use** rather than power.

## How it checks

- **Ping** runs the system `ping` command once per check (1 s timeout).
- **ARP** reads `/proc/net/arp` on Linux (falls back to `arp -n`). A device counts as present when it has a complete ARP entry.

?> Many TVs keep their network connection in standby ("quick start", "wake on LAN"). Then they answer ping while off. Turn that feature off on the TV, or use `pingUseArp`, or accept that the tile shows *on* in standby.

!> Ping runs every `pingFrequency` seconds per accessory. With many accessories, use 2–5 seconds rather than 1.
