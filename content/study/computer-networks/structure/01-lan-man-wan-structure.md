---
id: aa873695-84a4-7d9a-96a0-c657b1bb8a2e
key: topic:computer-networks/structure
subject: computer-networks
topic: structure
title: LAN / MAN / WAN & Structure
slug: lan-man-wan-structure
order: 1
---

How small local networks chain together to form the internet — and the analogy that makes layering click.

# Network scale classifications

| Term | Full name | Scale | Typical medium |
| --- | --- | --- | --- |
| <strong>LAN</strong> | Local Area Network | A single home, office, or building | Ethernet cables, Wi-Fi |
| <strong>MAN</strong> | Metropolitan Area Network | Across a city | Fiber backbones connecting multiple LANs |
| <strong>WAN</strong> | Wide Area Network | Across countries / continents | <strong>SONET</strong> (Synchronous Optical Network), leased lines, satellite |

<strong>Frame Relay</strong> is a WAN protocol historically used to connect LANs across a wide area cost-effectively, by packaging data into variable-length "frames" sent over a shared carrier network — a precursor to many of today's WAN/VPN technologies.

> [!INFO] Big picture
>
> The <strong>internet</strong> is simply the collection of all interconnected LANs, MANs, and WANs across the world — your home LAN connects to your ISP's MAN, which peers into global WAN backbones, which connect to other countries' networks.

# Modem / Router — the bridge between worlds

A <strong>modem</strong> converts digital signals (what your computer understands) into analog signals (what travels over telephone/cable lines) and vice versa — the literal translator between your home network and your ISP's infrastructure. A <strong>router</strong> is the device that decides where to forward data packets next, both within your home network and out to the internet (in home setups, the ISP-provided device is usually a combined modem+router).

# Tier 1 vs Tier 2 ISPs

- <strong>Tier 1 ISPs</strong> — own global backbone infrastructure and don't pay anyone for transit (e.g. TATA Communications). They peer directly with each other.
- <strong>Tier 2 ISPs</strong> — regional/national providers (e.g. Airtel, Jio) that buy transit from Tier 1s to reach the rest of the internet, while also peering with each other locally.

# The Amazon delivery analogy

This is the mental model that makes the entire layered approach (OSI/TCP-IP) click: shipping a physical package mirrors exactly how data is "shipped" across a network.

You order → Amazon → Delivery company → Transported (across India) → Local delivery → You receive

Notice each stage only cares about its own job: Amazon doesn't drive the truck, the delivery company doesn't know what's inside the box, and the truck driver doesn't know who the recipient is beyond an address label. This is exactly the idea of <strong>layering</strong> — each network layer only does its specific job and hands the package to the next layer, ignorant of what the layers above or below are doing with the contents.

> [!TIP] Application layer connection
>
> In this analogy, "placing the order" and "receiving the package" are the parts <em>you</em> directly interact with — this maps to the <strong>Application Layer</strong>, the only layer that's visible to the end user. Everything else (the courier routing, the trucks, the roads) happens invisibly underneath, just like the lower OSI layers.
