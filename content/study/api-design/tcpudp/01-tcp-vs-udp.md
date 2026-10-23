---
id: 825c0d3f-6460-77a5-ada7-7f13920fb6c4
key: topic:api-design/tcpudp
subject: api-design
topic: tcpudp
title: TCP vs UDP
slug: tcp-vs-udp
order: 1
---

These transport protocols determine how data physically moves between machines. Everything above — HTTP, WebSockets, gRPC — runs on top of one or the other.

> [!NOTE] TCP — Transmission Control Protocol
>
> Reliable but slower. Guarantees every packet arrives in order. Uses the 3-way handshake to establish connection.
>
> <strong>3-way handshake</strong>
>
> 1\. SYN client → server: "I want to connect"
>
> 2\. SYN-ACK server → client: "OK, I'm ready"
>
> 3\. ACK client → server: "Connection established!"
>
> Banking APIs · Email · HTTP/REST · WebSockets · gRPC

> [!NOTE] UDP — User Datagram Protocol
>
> Fast but unreliable. Fire-and-forget. No handshake, no delivery guarantee, no ordering. Less overhead = lower latency.
>
> <strong>Packet lost?</strong> UDP says "NO RESENDING." A frame skip is acceptable; a 300ms stutter to retransmit is not.
>
> Video calls · Online gaming · Live streaming · DNS · HTTP/3 (QUIC)
>
> <strong>Rule:</strong> If losing a packet hurts less than waiting for a retransmit — use UDP. If every byte must arrive — use TCP.

| Property | TCP | UDP |
| --- | --- | --- |
| Connection | Connection-oriented (handshake) | Connectionless |
| Reliability | Guaranteed delivery + ordering | No guarantees |
| Speed | Slower (overhead) | Faster |
| Header size | 20 bytes minimum | 8 bytes |
| Use case | HTTP, email, file transfer | Video, gaming, DNS, VoIP |
