---
id: 0ad875cf-f14a-70ba-962a-5d444d12cf07
key: topic:computer-networks/l1
subject: computer-networks
topic: l1
title: Layer 1 — Physical
slug: layer-1-physical
order: 1
---

Where raw bits travel as copper voltages, light pulses, or radio signals.

> [!INFO] Definition
>
> The <strong>Physical Layer</strong> is the hardware base of the network. It deals with the transmission and reception of unstructured raw data streams (bits) over physical media. It defines electrical voltages, light frequencies, connector shapes, cable specs, and transmission speeds.

PDU: Bit

Focus: Electrical/Optical Signals

Hardware: Hubs, Repeaters, Cables, Modems

# Core Purpose &amp; Function

Layer 1 has no understanding of packet headers, addresses, or applications. It is strictly concerned with sending a series of electrical or optical pulses representing "1" or "0" down a wire, and ensuring that a receiver interprets those physical pulses back into matching bits.

# Key Responsibilities

- <strong>Bit Representation</strong>: Defining how 1s and 0s are coded (e.g. changes in voltage levels, light brightness, or radio frequency phases).
- <strong>Bandwidth &amp; Data Rates</strong>: Governing the maximum bit rate (transmission speed in Mbps/Gbps) supported by a cable type.
- <strong>Physical Media Specifications</strong>: Standardizing wire thicknesses, fiber core widths, connector shapes (like RJ45 plugs), and shielding specifications.
- <strong>Line Configuration &amp; Duplexing</strong>: Defining whether transmission is point-to-point, simplex (one-way), half-duplex, or full-duplex.

# Common Physical Media

| Medium Type | Description | Typical Speed | Pros / Cons |
| --- | --- | --- | --- |
| <strong>Unshielded Twisted Pair (UTP)</strong> | Copper wires twisted to reduce interference | 100 Mbps – 10 Gbps | Cheap, flexible, but short range (\~100m) |
| <strong>Fiber Optic Cable</strong> | Glass strands transmitting light pulses | 1 Gbps – 100+ Gbps | Immune to electromagnetic interference, long range |
| <strong>Coaxial Cable</strong> | Shielded copper conductor | 10 – 100 Mbps | Resistant to noise, used for cable TV/broadband |
| <strong>Radio Frequencies</strong> | Electromagnetic waves traveling through air | Up to 10 Gbps (Wi-Fi 7) | No physical wires needed, but prone to walls/noise |

# Analogy: The Asphalt Roads &amp; Highways

> [!TIP] Amazon Analogy
>
> The Physical Layer is the <strong>actual asphalt roads, physical bridges, and truck engines</strong>. It represents the physical tires rolling on the road. Without the asphalt, no delivery van can move. It doesn't know what's in the van or where it's going; it is just the physical conduit that allows travel.

# Hardware &amp; Physical Connectors

> [!TIP] Pros
>
> - Establishes the physical link necessary for any network to function.
> - Fiber optics provide near-light-speed transmission over massive distances.

> [!DANGER] Cons
>
> - Vulnerable to physical damage (cuts, water leaks, severe weather).
> - Signal attenuation requires repeaters/amplifiers over long distances.
