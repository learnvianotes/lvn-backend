---
id: e08ff42f-0789-720f-bb71-7ecc8629a7e7
key: topic:computer-networks/protocols
subject: computer-networks
topic: protocols
title: Protocols & Core Terms
slug: protocols-core-terms
order: 1
---

The vocabulary you need before any of the layered models make sense.

> [!INFO] Definition
>
> A <strong>protocol</strong> is a set of rules that defines how data is formatted, transmitted, and interpreted between devices. Just like two people need a shared language to have a conversation, two computers need a shared protocol to exchange meaningful data.

Protocols aren't invented by a single company — they're standardized, often region-by-region and globally, by bodies like the <strong>Internet Society</strong>, with the actual technical specifications published as <strong>RFCs</strong> (Request For Comments) through the <strong>RFC Editor</strong>. An RFC is essentially the "spec document" engineers refer back to when implementing a protocol correctly.

# Client–Server model

The dominant pattern for how applications talk over a network:

Client request → Server

Client ← response Server

- <strong>Client</strong> — initiates the request (your browser, your phone app).
- <strong>Server</strong> — a machine that's always listening, waiting to respond to requests (identified by an IP address).

# Casting modes: Unicast, Broadcast, Multicast

How data is addressed and distributed across the network determines its casting mode, operating at both Layer 2 (MAC) and Layer 3 (IP):

> [!INFO] Unicast (One-to-One)
>
> Data is sent from a single sender to a single specific receiver. The packet contains one destination IP/MAC address. Used for web browsing, emails, and direct file transfers.

> [!INFO] Broadcast (One-to-All)
>
> Data is sent from a single sender to <em>all</em> hosts on the same local network subnet. Packets are addressed to a special broadcast address (e.g. `255.255.255.255`). Routers block broadcasts to keep traffic localized. Used for ARP resolution and DHCP discovery.

> [!INFO] Multicast (One-to-Many)
>
> Data is sent from a single sender to a specific group of interested receivers who have subscribed to a multicast group IP (ranges `224.0.0.0` to `239.255.255.255`). Switches and routers replicate the packets only to ports with active subscribers. Used for live IPTV, video conferencing, and routing protocol updates.

> [!TIP] Real-world Analogy
>
> <strong>Unicast</strong> is sending a private letter to a specific home. <strong>Broadcast</strong> is shouting through a megaphone in a neighborhood square where everyone hears you. <strong>Multicast</strong> is sending a magazine only to subscribers of a particular interest club.

# Circuit Switching vs Packet Switching

The two fundamental paradigms of moving data through a network mesh:

> [!INFO] Circuit Switching
>
> A dedicated physical communication path (circuit) is established between the sender and receiver before any data is sent. The capacity of the path is reserved and cannot be shared. If no data is sent, the resource is wasted.

> [!INFO] Packet Switching
>
> Data is broken into smaller chunks called <strong>packets</strong>, each containing a header with routing info. Packets travel independently through the network, sharing paths dynamically (statistical multiplexing) and being queued at routers (store-and-forward).

> [!TIP] Postal vs Phone Analogy
>
> <strong>Circuit Switching</strong> is like making a phone call: the line is reserved just for your voice, and no one else can use it until you hang up. <strong>Packet Switching</strong> is like sending a multi-chapter book through the mail: each page is placed in an envelope and mailed separately. They might take different routes and arrive out of order, but they are reassembled at the destination.

# Direct Comparison

| Metric / Feature | Circuit Switching | Packet Switching |
| --- | --- | --- |
| <strong>Resource Reservation</strong> | Dedicated path reserved upfront | Dynamic sharing on demand |
| <strong>Congestion / Queuing</strong> | None (Guaranteed bandwidth) | Yes (Packets wait in router queues) |
| <strong>Setup Delay</strong> | High (Requires signaling handshake) | None (Immediate transmission) |
| <strong>Link Efficiency</strong> | Low (Wasted during silence/idle) | High (Bursty traffic multiplexed) |
| <strong>Failure Resilience</strong> | Low (If a link cuts, the call drops) | High (Packets routed dynamically around faults) |
| <strong>Primary Use Case</strong> | Landline telephony (PSTN), GSM voice | The Internet, LANs, WANs |

# IP Addresses

> [!INFO] Definition
>
> An <strong>IP address</strong> is a numeric label assigned to every device on a network, used to identify and locate it — conceptually, the "phone book entry" of the internet.

Every server you talk to is identified by an IP address, even though you usually type a domain name instead (DNS bridges that gap — covered later).

> [!TIP] Try it
>
> On macOS/Linux, run `curl ifconfig.me -s` in a terminal — it returns your machine's public IP address as seen from the internet.

# ISPs and the chain to your device

Your <strong>ISP</strong> (Internet Service Provider — e.g. Airtel, Jio, Comcast) is the company that actually connects your home or office to the wider internet.

1. The ISP gives you a <strong>modem/router</strong>, which is assigned a <strong>global (public) IP address</strong> — visible to the rest of the internet.
2. Inside your home, the router connects to internal devices (laptop, phone, smart TV).
3. Each of those internal devices gets a <strong>private/local IP address</strong>, automatically handed out by <strong>DHCP</strong> (Dynamic Host Configuration Protocol).

# Ports

> [!INFO] Definition
>
> A <strong>port number</strong> identifies a specific application or service running on a device — the IP address gets you to the right machine, the port gets you to the right program on that machine.

- Ports are <strong>16-bit numbers</strong> → range from 0 to 2¹⁶−1, i.e. roughly <strong>65,535</strong> available ports.
- <strong>0–1023</strong> — well-known / reserved ports (e.g. HTTP = 80, HTTPS = 443, MongoDB = 27017).
- <strong>1024–49151</strong> — registered ports, used by specific named applications.
- <strong>49152–65535</strong> — dynamic/ephemeral ports, free for short-lived use (e.g. the temporary port your browser tab uses for one connection).

# Bandwidth &amp; speed units

| Unit | Meaning | Value |
| --- | --- | --- |
| <strong>kbps</strong> | kilobits per second | 1,000 bits/sec |
| <strong>Mbps</strong> | megabits per second | 1,000,000 bits/sec |
| <strong>Gbps</strong> | gigabits per second | 10⁹ bits/sec |

Internet connections are described by separate <strong>upload speed</strong> and <strong>download speed</strong> — most home connections are asymmetric, with download much faster than upload, since typical usage (browsing, streaming) receives far more data than it sends.

# Network Delay, Throughput &amp; Goodput

When measuring network performance, bandwidth alone is insufficient. We must track how long data takes to travel, how much arrival time varies, and how much actual data is successfully processed.

> [!INFO] Latency (Delay)
>
> The total time it takes for a data packet to travel from the source to the destination host. Latency is the sum of four distinct components: <strong>Nodal Delay</strong> = Processing Delay + Queuing Delay + Transmission Delay + Propagation Delay.

> [!INFO] Jitter
>
> The variation or fluctuation in packet arrival times (packet delay variation). High jitter causes packets to arrive out of order or clumped together, resulting in choppy audio/video during VoIP calls or video streams.

> [!INFO] Throughput vs Goodput
>
> <strong>Throughput</strong> is the total rate at which bits are sent over the physical link per unit time (including TCP/IP headers, metadata, and retransmissions). <strong>Goodput</strong> is the rate of actual useful application-level payload data successfully delivered (excluding all protocol header overhead and duplicate packets).

> [!TIP] Throughput vs Goodput example
>
> If you download a 10MB file and due to a poor connection 2MB of packets are corrupted and retransmitted, your link's <strong>throughput</strong> counts all 12MB of data sent. However, the <strong>goodput</strong> only counts the 10MB of successfully reassembled file payload delivered to your browser.

# The Four Sources of Packet Delay (Nodal Delay)

A packet experiences different delays at each router hop along its path:

> [!INFO] 1. Processing Delay (d_proc)
>
> The time a router takes to inspect a packet's header, check for bit-level errors using checksums, and determine the next-hop interface. Usually microseconds or less.

> [!INFO] 2. Queuing Delay (d_queue)
>
> The time a packet spends waiting in the router's buffer queues before being transmitted. Depends heavily on network congestion and the traffic intensity ($L \\cdot a / R$ where $L$ is packet length, $a$ is arrival rate, $R$ is transmission rate). Can range from microseconds to seconds.

> [!INFO] 3. Transmission Delay (d_trans)
>
> The time taken to push all the packet's bits onto the physical wire. Formula: `d_trans = L / R` (where `L` is packet length in bits, and `R` is the transmission rate of the link in bps). Depends on packet size and wire speed.

> [!INFO] 4. Propagation Delay (d_prop)
>
> The time it takes for a single bit to travel physically from one end of the link to the other at the speed of light in the physical medium. Formula: `d_prop = d / s` (where `d` is physical distance, and `s` is propagation speed, roughly $2 \\times 10^8$ m/s in optical fiber). Depends only on distance and medium, not packet size.

> [!TIP] Memory Aid
>
> Remember the delay sources top-to-bottom: <strong>P</strong>eople <strong>Q</strong>uickly <strong>T</strong>ake <strong>P</strong>athways — <strong>P</strong>rocessing, <strong>Q</strong>ueuing, <strong>T</strong>ransmission, <strong>P</strong>ropagation.

> [!INFO] Quality of Service (QoS)
>
> A suite of technologies (like traffic shaping, packet tagging, and priority queuing) used to manage traffic congestion. QoS ensures high-priority, latency-sensitive packets (like live voice/video) are processed ahead of non-critical traffic (like bulk file downloads).

# Guided vs unguided media

> [!INFO] Guided
>
> Data travels along a physically defined path — copper or fiber cable. Faster and more reliable because the path is fixed and shielded from interference.

> [!INFO] Unguided
>
> Data travels through open space with no single fixed path — radio waves. Used by Wi-Fi and Bluetooth (short range) and 3G/4G/LTE/5G (long range).

# How continents are physically connected

Even satellite and radio aside, the backbone of global internet traffic is <strong>physical undersea cables</strong> — optical fiber laid across ocean floors connecting continents. You can see the actual global map of these at `submarinecablemap.com`, maintained by TeleGeography — it shows hundreds of named cables (2Africa, AEConnect-1, etc.) physically linking landing points across every continent.

> [!NOTE]
>
> Physical cables remain faster and more reliable than wireless long-haul links, which is why almost all intercontinental internet traffic — even from "wireless" companies — ultimately rides on undersea fiber.
