---
id: 463a833e-a56f-76ea-9445-dc94a4b133df
key: topic:computer-networks/l4
subject: computer-networks
topic: l4
title: Layer 4 — Transport
slug: layer-4-transport
order: 1
---

The engine room, managing segment assembly, error correction, and application sockets.

> [!INFO] Definition
>
> The <strong>Transport Layer</strong> is responsible for host-to-host communication. It takes data from the session layer, breaks it into smaller units called <strong>segments</strong>, and ensures they are delivered reliably, in the correct order, without error, and directly to the correct application socket using port numbers.

PDU: Segment (TCP) / Datagram (UDP)

Focus: End-to-End Reliability

Hardware: OS Kernel / Sockets

# Core Purpose &amp; Function

While the Network Layer below routes packets to the correct \*physical computer\*, the Transport Layer is the one that gets the data to the correct \*software process\* on that computer. It acts as the supervisor of the connection, handling flow control, sequencing, and packet loss recovery.

# Key Responsibilities

- <strong>Port Addressing &amp; Multiplexing</strong>: Attaching source and destination ports. This allows a laptop to run Slack, Zoom, and a browser simultaneously without their data streams mixing.
- <strong>Segmentation &amp; Reassembly</strong>: Dividing data into chunks size-optimized for the MTU (Maximum Transmission Unit) of the network, and re-assembling them in order at the destination.
- <strong>Flow Control</strong>: Preventing a fast sender from overwhelming a slow receiver by negotiating window sizes.
- <strong>Error Recovery &amp; ACKs</strong>: Using checksums to spot corruption and retransmitting lost packets when timers expire.

# TCP vs UDP — The Transport Split

| Feature | TCP (Transmission Control Protocol) | UDP (User Datagram Protocol) |
| --- | --- | --- |
| <strong>Connection</strong> | Connection-oriented (Requires 3-Way Handshake) | Connectionless (Fire and Forget) |
| <strong>Reliability</strong> | Guaranteed delivery (Retransmits lost segments) | Best-effort delivery (No retransmission) |
| <strong>Ordering</strong> | Guaranteed in-order reassembly | No ordering guarantees |
| <strong>Header Size</strong> | 20 bytes minimum | 8 bytes fixed |
| <strong>Use Case</strong> | Web browsing (HTTP), Email, File transfer (FTP) | Voice calls (VoIP), Video streams, DNS |

# Analogy: The Shipment Box labeling and Tracking Numbers

> [!TIP] Amazon Analogy
>
> The Transport Layer corresponds to the <strong>delivery coordinator packing your items into numbered boxes</strong>. They label box 1/3, 2/3, 3/3, and require a signature (ACK) upon delivery. If box 2/3 goes missing on the highway, they re-ship box 2/3. At your door, they reassemble the three boxes in order before handing them to you.

# Flow Control &amp; Congestion Control

> [!TIP] Pros
>
> - End-to-end data integrity guarantees (for TCP).
> - Enables multitasking (multiplexing) on a single physical link.
> - Prevents packet loss due to receiver buffer overload.

> [!DANGER] Cons
>
> - TCP handshakes add latency before any data is sent.
> - Heavy CPU and memory usage to buffer and track outstanding acknowledgements.
