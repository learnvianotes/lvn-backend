---
id: a39d2950-2dc0-72dd-a704-7b6d91d20d04
key: topic:computer-networks/devices
subject: computer-networks
topic: devices
title: Networking Devices
slug: networking-devices
order: 1
---

The physical building blocks that move bits between machines, organized by the OSI layer they operate at.

| Device | OSI Layer | What it does |
| --- | --- | --- |
| <strong>Repeater</strong> | Physical (L1) | Regenerates a weakened or corrupted signal so it can travel further over the same network, restoring its original strength/shape. |
| <strong>Hub</strong> | Physical (L1) | A multi-port repeater — receives data on one port and broadcasts it to <strong>all</strong> connected devices. All hosts share one <strong>collision domain</strong>. Comes in <strong>Active</strong> (regenerates signal) and <strong>Passive</strong> (just splits the signal) variants. |
| <strong>Bridge</strong> | Data Link (L2) | Filters traffic by reading source/destination MAC addresses, intelligently interconnecting two LAN segments instead of blindly broadcasting like a hub. Comes as <strong>transparent bridges</strong> (invisible to hosts) and <strong>source routing bridges</strong> (path chosen by the source). |
| <strong>Router</strong> | Network (L3) | Forwards packets between different networks based on IP addresses, using routing tables and path-selection algorithms. |
| <strong>Gateway</strong> | Any / multiple | A passage connecting two networks that may run on entirely different networking models/protocols — translates between them. |
| <strong>Brouter</strong> | L2/L3 hybrid | A combination device that behaves as both a bridge and a router, depending on the traffic. |

> [!INFO] Why hubs lost to switches
>
> Although not explicitly named in the original notes, the practical successor to the hub is the <strong>switch</strong> — it behaves like a smarter hub that, similar to a bridge, reads MAC addresses and forwards data only to the specific port the destination device is on, rather than broadcasting to everyone. This is why switches replaced hubs in virtually all modern wired networks.
