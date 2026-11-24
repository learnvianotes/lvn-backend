---
id: cef357fc-7992-7c6f-a966-6c7398c22bf4
key: topic:computer-networks/ip
subject: computer-networks
topic: ip
title: IP Addressing & Subnetting
slug: ip-addressing-subnetting
order: 1
---

How packets get routed, classed, and divided across the global network.

# Routing fundamentals

Every router maintains a <strong>routing table</strong> (a data structure mapping destination addresses to the next hop) — when computer A sends data to computer B, it doesn't go directly; it's relayed <strong>hop-by-hop</strong> through a chain of routers, each forwarding it one step closer using its own table, until it reaches the destination.

In graph terms: routers are <strong>nodes</strong>, the links between them are <strong>edges</strong> — and finding the best path through this graph is a routing/shortest-path problem.

> [!INFO] Static routing
>
> Routes are configured manually by an administrator — simple but doesn't adapt to network changes.

> [!INFO] Dynamic routing
>
> Routes are computed and updated automatically as the network changes, using algorithms like Bellman-Ford or Dijkstra's algorithm.

The component that builds and maintains these routing tables is referred to as the <strong>control plane</strong> of the network.

# IPv4 vs IPv6

| Feature | IPv4 | IPv6 |
| --- | --- | --- |
| <strong>Bit length</strong> | 32 bits | 128 bits |
| <strong>Format</strong> | 4 decimal "octets" (e.g. 192.168.2.30) | 8 groups of hexadecimal (e.g. ABFE:F001:3210:9182:0:0:1:2) |
| <strong>Address space</strong> | 2³² ≈ 4.3 billion unique addresses | 2¹²⁸ ≈ 3.403 × 10³⁸ unique addresses |
| <strong>Adoption challenge</strong> | — | Not backward compatible with IPv4; requires significant ISP/hardware migration |

An IPv4 address like `192.168.2.30` splits into a <strong>network/subnet ID</strong> (e.g. `192.168.2`) identifying which network the device belongs to, and a <strong>device/host address</strong> (the final `30`) identifying the specific machine within that network.

# IPv4 address classes

| Class | Range | Typical use |
| --- | --- | --- |
| <strong>A</strong> | 0.0.0.0 – 127.255.255.255 | Very large networks (few networks, huge host count) |
| <strong>B</strong> | 128.0.0.0 – 191.255.255.255 | Medium-to-large networks |
| <strong>C</strong> | 192.0.0.0 – 223.255.255.255 | Small networks (most common, e.g. home routers) |
| <strong>D</strong> | 224.0.0.0 – 239.255.255.255 | Multicast addressing |
| <strong>E</strong> | 240.0.0.0 – 255.255.255.255 | Reserved, experimental use |

# Subnet masking

> [!INFO] Definition
>
> A <strong>subnet mask</strong> "masks" the network portion of an IP address, leaving the remaining bits to identify the specific host. It tells devices which part of an address is the network and which part is the individual device.

For a Class C address, the default mask is `255.255.255.0` — the first three octets identify the network, the last identifies the host. <strong>CIDR notation</strong> (e.g. `/24`) is the modern compact way to express this, where the number indicates how many leading bits are the network portion.

> [!TIP] Worked example — variable length subnetting
>
> Given `192.0.1.0/24`: the network covers addresses from <strong>192.0.1.0</strong> (start) to <strong>192.0.1.255</strong> (end) — 256 total addresses, with the /24 meaning the first 24 bits are fixed as the network portion, leaving 8 bits (2⁸ = 256) for host addresses within it.

# Reserved &amp; special addresses

- `127.0.0.0/8` — the <strong>loopback</strong> range. `127.0.0.1` specifically is "localhost" — it lets a device contact itself, useful for a machine acting as both client and server during local development/testing.

# Anatomy of an IP packet header

Every IP packet carries a 20-byte header containing:

Version (IPV)

Header Length

Identification

Flags

Protocol

Checksum

Source Address

Destination Address

TTL

> [!INFO] TTL — Time To Live
>
> A counter that decreases by 1 at every router hop. It exists because packets can sometimes get stuck looping between routers — once TTL hits 0, the packet is dropped, preventing it from circulating forever. A typical starting TTL value is around 60–64.

# Middleboxes — Firewalls

A <strong>firewall</strong> is an extra device sitting between your trusted internal network and the broader, untrusted internet, filtering traffic based on configurable rules.

- Filters by source/destination <strong>address</strong>
- Filters by <strong>port number</strong>
- Filters by <strong>protocol</strong> and packet <strong>flags</strong>

> [!INFO] Stateless firewall
>
> Examines each packet in isolation against static rules — faster but less context-aware.

> [!INFO] Stateful firewall
>
> Tracks the state of active connections, allowing traffic that's part of a connection it already recognizes as legitimate (e.g. a response to a request you sent) — more secure but more resource-intensive.
