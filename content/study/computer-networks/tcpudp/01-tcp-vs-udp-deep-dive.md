---
id: fe3a547d-eef6-77c7-962d-59fbdd29b565
key: topic:computer-networks/tcpudp
subject: computer-networks
topic: tcpudp
title: TCP vs UDP, Deep Dive
slug: tcp-vs-udp-deep-dive
order: 1
---

The two transport protocols, and why an application picks one over the other.

# Multiplexing &amp; demultiplexing

> [!INFO] Multiplexing
>
> Allows many different streams (a message, a file, a video call) to all be sent to the destination through one shared medium/connection, by the Transport Layer combining them with distinct port numbers.

> [!INFO] Demultiplexing
>
> The reverse process on the receiving end — using <strong>sockets</strong> (the gateway between an application and the network, identified by IP + port) to correctly route incoming data back to the right application.

# Checksums — how corruption is detected

Both TCP and UDP use checksums to detect data corruption:

1. The sender computes a checksum value from the data using a defined algorithm and attaches it alongside the data.
2. The data + checksum travel together across the network.
3. The receiver re-runs the same algorithm on the received data and compares the result against the attached checksum.
4. If they match, the data is assumed intact; if not, it's flagged as corrupted.

# Reliability mechanics — timers, ACKs, sequencing

- When data is sent, a <strong>timer</strong> starts.
- An <strong>acknowledgement (ACK)</strong> from the receiver stops the timer, confirming successful delivery.
- If no ACK arrives before the timer expires, a <strong>retransmission</strong> is triggered.
- <strong>Problem:</strong> if data was actually received but the ACK itself was lost, naive retransmission would cause <strong>duplicate data</strong>.
- <strong>Solution:</strong> <strong>sequence numbers</strong> let the receiver recognize and discard duplicates, and reassemble data in the correct order even if packets arrive out of sequence.

# UDP — User Datagram Protocol

> [!INFO] Definition
>
> UDP is a lightweight, <strong>connectionless</strong> transport protocol. It sends data without establishing a dedicated connection first, and without guaranteeing delivery, order, or integrity beyond a basic checksum.

- Data <strong>may or may not</strong> be delivered — no acknowledgements, no retransmission
- Data may be received out of order, damaged, or duplicated — UDP doesn't fix any of that itself
- Still uses a checksum, but doesn't act on a failure beyond detecting it
- <strong>Why use it anyway:</strong> it's much faster, because it skips all the handshake/acknowledgement/retransmission overhead

<strong>Common uses:</strong> video conferencing, online gaming, and DNS lookups — all cases where speed matters more than guaranteed perfect delivery (a slightly garbled video frame is fine; waiting for a perfect retransmitted one isn't).

## UDP Packet structure

Total header size: <strong>8 bytes</strong>, split into four 2-byte fields:

| Field | Size |
| --- | --- |
| Source Port No. | 2 bytes |
| Destination Port No. | 2 bytes |
| Length of datagram | 2 bytes |
| Checksum | 2 bytes |
| Data (payload) | variable |

`4 fields × 2 bytes = 8 bytes header (16 bits each × 4 = 64 bits = 8 bytes)`

> [!TIP] Try it
>
> Run `tcpdump -c 5` in a terminal (with sufficient permissions) to capture and inspect the first 5 live packets crossing your network interface.

# TCP — Transmission Control Protocol

> [!INFO] Definition
>
> TCP is a <strong>connection-oriented</strong>, reliable transport protocol. Before any data is sent, both sides establish a dedicated connection, and TCP guarantees that data arrives complete, uncorrupted, and in the correct order.

- Application layer hands TCP large amounts of raw data; TCP divides it into chunks, adds headers and a checksum to each
- Tracks two critical things: data that doesn't arrive (via timers/retransmission) and data order (via sequence numbers)
- <strong>Congestion control</strong> — dynamically adjusts how much data is sent based on network conditions, to avoid overwhelming the network

## The Three-Way Handshake

Before any actual data flows, TCP establishes a connection using a three-step exchange:

Client → SYN (seq=x) → Server

Server → SYN-ACK (seq=y, ack=x+1) → Client

Client → ACK (seq=x+1, ack=y+1) → Server

1. <strong>SYN</strong> — client sends a synchronization flag with an initial sequence number, requesting a connection.
2. <strong>SYN-ACK</strong> — server acknowledges and sends its own sequence number back (a mathematically derived next value).
3. <strong>ACK</strong> — client acknowledges the server's sequence number, and the connection is now fully established — data can now flow bidirectionally.

# TCP vs UDP — side by side

| Property | TCP | UDP |
| --- | --- | --- |
| <strong>Connection</strong> | Connection-oriented (handshake first) | Connectionless |
| <strong>Reliability</strong> | Guaranteed delivery, retransmits lost data | Best-effort, no guarantees |
| <strong>Ordering</strong> | Guaranteed in-order delivery | No ordering guarantee |
| <strong>Speed</strong> | Slower (overhead of handshake, ACKs) | Faster (minimal overhead) |
| <strong>Header size</strong> | 20 bytes minimum | 8 bytes fixed |
| <strong>Use cases</strong> | Web (HTTP), email, file transfer | Video calls, gaming, DNS |
