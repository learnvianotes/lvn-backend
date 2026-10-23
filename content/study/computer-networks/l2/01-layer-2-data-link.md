---
id: 99cceed1-a96d-74b6-9f7e-4613d71e3b8e
key: topic:computer-networks/l2
subject: computer-networks
topic: l2
title: Layer 2 — Data Link
slug: layer-2-data-link
order: 1
---

Hop-by-hop delivery, framing packets into physical frames, and resolving MAC addresses.

> [!INFO] Definition
>
> The <strong>Data Link Layer</strong> handles direct node-to-node communication on the same local network. It takes IP packets, wraps them in <strong>frames</strong> containing physical hardware addresses (MAC addresses), detects errors on the wire, and controls access to the physical transmission medium.

PDU: Frame

Focus: Local Hops &amp; Media Access

Hardware: Switches, Bridges, NICs

# Core Purpose &amp; Function

Layer 3 moves packets globally, but Layer 2 is what physically walks the packet across individual wires between immediate neighbors. It bridges the logical network layer with the physical copper/glass wire, using MAC addresses to resolve precisely which network card on a shared cable should open a frame.

# Key Responsibilities

- <strong>Framing</strong>: Wrapping packets with start/stop indicators and error check sequences (FCS/CRC checksums) to establish where a frame begins and ends.
- <strong>Physical Addressing</strong>: Adding source and destination MAC addresses to frames. MAC addresses are 48-bit numbers burned into NIC hardware at the factory.
- <strong>Media Access Control (MAC)</strong>: Coordinating who is allowed to transmit on shared networks (like Wi-Fi frequencies or shared Ethernet hubs) using collision detection or avoidance systems (CSMA/CD, CSMA/CA).
- <strong>Address Resolution (ARP)</strong>: Finding the hardware MAC address of a destination IP on the local subnet using local ARP broadcasts.

# Common Protocols at Layer 2

| Protocol | Description | Role in Local Network |
| --- | --- | --- |
| <strong>Ethernet (802.3)</strong> | Wired network protocol | Main standard for wired home/office LANs. |
| <strong>Wi-Fi (802.11)</strong> | Wireless local network standard | Uses CSMA/CA to transmit frames wirelessly through the air. |
| <strong>ARP</strong> | Address Resolution Protocol | Resolves IP addresses to physical MAC addresses. |
| <strong>PPP / Frame Relay</strong> | Point-to-Point Protocol | Wired WAN links connecting distant routers directly. |

# Analogy: The Local Delivery Van

> [!TIP] Amazon Analogy
>
> The Data Link Layer represents the <strong>local delivery van driving from the post office to your house</strong>. The van cares about local physical markers (your house number and gate, mapping to MAC addresses) to drop off the box. The van driver only operates on your neighborhood roads (local LAN switch) and doesn't know about inter-state highways.

# LAN Devices &amp; Media Control

> [!TIP] Pros
>
> - Extremely fast hardware switching (L2 switches read MAC addresses in silicon).
> - Robust error detection filters out corrupted frames immediately.
> - Avoids signal collisions on shared media.

> [!DANGER] Cons
>
> - Completely localized: cannot route data beyond its own local subnet.
> - Broadcast storms (ARP loops) can overwhelm the network if L2 loops exist.
