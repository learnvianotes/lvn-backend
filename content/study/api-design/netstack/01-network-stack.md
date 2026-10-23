---
id: 851c1687-e699-76db-b481-def58511d675
key: topic:api-design/netstack
subject: api-design
topic: netstack
title: Network stack
slug: network-stack
order: 1
---

APIs live at the application layer. Understanding the stack explains why protocol choice matters — each layer has constraints the layer above must work within.

> [!NOTE]
>
> Application layer — HTTP/HTTPS, WebSockets, MQTT, AMQP, gRPC

↑ builds on

> [!NOTE]
>
> Transport layer — TCP (reliable), UDP (fast)

↑ builds on

> [!NOTE]
>
> Network layer — IP (IPv4 / IPv6)

↑ builds on

> [!NOTE]
>
> Data link — Ethernet, WiFi, Bluetooth

↑ builds on

> [!NOTE]
>
> Physical — cables, radio waves, fiber

> [!NOTE]
>
> <strong>Why this matters:</strong> When you choose REST over gRPC, you're choosing HTTP/1.1 vs HTTP/2. When you choose WebSockets, you're choosing a persistent TCP connection. Protocol choice shapes latency, throughput, and API design.

# HTTP versions

| Version | Transport | Multiplexing | Push | Used by |
| --- | --- | --- | --- | --- |
| HTTP/1.1 | TCP (1 req/conn) | No (HoL blocking) | No | Most REST APIs |
| HTTP/2 | TCP (multiplexed) | Yes | Server push | gRPC, modern browsers |
| HTTP/3 | QUIC (UDP-based) | Yes | Yes | CDNs, future APIs |
