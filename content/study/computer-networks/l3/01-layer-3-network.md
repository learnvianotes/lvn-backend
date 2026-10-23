---
id: 8310c5ee-2dc6-7be7-836b-b1693eb85eba
key: topic:computer-networks/l3
subject: computer-networks
topic: l3
title: Layer 3 — Network
slug: layer-3-network
order: 1
---

Where packets are stamped with IP addresses and routed across network borders.

> [!INFO] Definition
>
> The <strong>Network Layer</strong> is the routing engine of the internet. It handles the movement of data units called <strong>packets</strong> across multiple independent networks. It defines logical addressing (IP addresses) and routes packets from their original source host to their final destination using path-selection algorithms.

PDU: Packet

Focus: Inter-Network Routing

Hardware: Routers / Layer 3 Switches

# Core Purpose &amp; Function

The Network Layer is where the boundaries of local networks (LANs) are crossed. While Layer 2 can only talk to immediate neighbors on the same cable or switch, Layer 3 is what allows packets to travel across routers, ISPs, and undersea cables to reach a server on the other side of the globe.

# Key Responsibilities

- <strong>Logical Addressing</strong>: Wrapping segments in IP packets, stamping them with source and destination IP addresses.
- <strong>Routing &amp; Path Selection</strong>: Routers calculate the optimal path through the global mesh using routing tables and algorithms (e.g. OSPF, BGP, RIP).
- <strong>Packet Fragmentation</strong>: Splitting large packets into smaller fragments if they exceed the MTU of a router interface, and setting flags to enable reassembly.
- <strong>Congestion Avoidance</strong>: Dropping or throttling packets when router queues fill up.

# Common Protocols at Layer 3

| Protocol | Full Name | Purpose |
| --- | --- | --- |
| <strong>IPv4</strong> | Internet Protocol version 4 | 32-bit logical addressing system (most common) |
| <strong>IPv6</strong> | Internet Protocol version 6 | 128-bit next-generation addressing system |
| <strong>ICMP</strong> | Internet Control Message Protocol | Sends diagnostic messages and error reports (used by `ping`) |
| <strong>IPSec</strong> | Internet Protocol Security | Provides authentication and encryption for Layer 3 packets (VPN tunnels) |

# Analogy: The Postal Routing Center

> [!TIP] Amazon Analogy
>
> The Network Layer is like the <strong>Postal Routing Center and GPS navigation</strong>. The box is stamped with a destination address (IP). The truck driver uses a map/GPS (routing table) to navigate through multiple toll roads and exits (routers/hops) to move the box closer to the final city, without needing to know who lives in the house.

# Path Selection Performance

> [!TIP] Pros
>
> - Connects millions of independent networks globally.
> - Dijkstra/Shortest-path routing automatically avoids congested or failed links.
> - Hierarchical addressing scales efficiently.

> [!DANGER] Cons
>
> - Best-effort delivery: packets can be dropped, delayed, or arrive out of order.
> - Router buffers introduce latency under high traffic load (bufferbloat).
