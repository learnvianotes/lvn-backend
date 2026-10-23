---
id: 7510236c-1ed7-7694-9e29-88c20f6ec0ad
key: topic:computer-networks/bits
subject: computer-networks
topic: bits
title: Bits, Bytes & Number Reference
slug: bits-bytes-number-reference
order: 1
---

Every bit-width that shows up across the stack, and what it's actually used for.

| Width | Used for | Possible values |
| --- | --- | --- |
| <strong>8-bit</strong> | One octet of an IPv4 address (e.g. the "192" in 192.168.1.1) | 2⁸ = 256 (0–255) |
| <strong>16-bit</strong> | Port numbers; each field in a UDP header (source port, dest port, length, checksum) | 2¹⁶ = 65,536 (0–65,535) |
| <strong>32-bit</strong> | An entire IPv4 address; TCP sequence/acknowledgement numbers | 2³² ≈ 4.3 billion |
| <strong>128-bit</strong> | An entire IPv6 address | 2¹²⁸ ≈ 3.403 × 10³⁸ |

# Visualizing a 16-bit port field

`1 0 1 0 0 1 1 0 0 0 1 0 1 0 0 1`

16 binary cells, each either 0 or 1 → 2¹⁶ total combinations ≈ 65,000 usable port numbers, split across the reserved (0–1023), registered (1024–49151), and dynamic/ephemeral (49152–65535) ranges.

# Header sizes worth memorizing

| Header | Size |
| --- | --- |
| UDP header | 8 bytes (4 × 16-bit fields) |
| TCP header | 20 bytes minimum |
| IP packet header | 20 bytes |
| MAC address | 48 bits (12 hex digits) |

# Data rate units

| Unit | Value |
| --- | --- |
| 1 kbps | 1,000 bits/sec |
| 1 Mbps | 1,000,000 bits/sec |
| 1 Gbps | 10⁹ bits/sec |

# Address space scale, side by side

> [!INFO] IPv4 — 32 bit
>
> 2³² ≈ <strong>4.3 billion</strong> total addresses — already exhausted globally, which is the core reason NAT and IPv6 both exist.

> [!INFO] IPv6 — 128 bit
>
> 2¹²⁸ ≈ <strong>3.4 × 10³⁸</strong> addresses — for scale, enough to assign a unique address to every grain of sand on Earth many times over.

computer networks · field reference · compiled from course notes + whiteboard captures
