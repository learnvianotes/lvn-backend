---
id: e84bbdd0-a7b8-7cf4-8b3b-a6f5f57d3a36
key: topic:computer-networks/nat
subject: computer-networks
topic: nat
title: NAT & Private Addressing
slug: nat-private-addressing
order: 1
---

How millions of home devices share a single public IP address.

> [!INFO] Definition
>
> <strong>NAT</strong> (Network Address Translation) is a technique that lets multiple devices on a private network share a single public IP address, by having the router rewrite source/destination addresses as packets cross between the private network and the public internet. This dramatically reduces global public IP address consumption.

Devices on a home/office network are typically assigned <strong>private IP addresses</strong> (e.g. the 192.168.x.x range), which only have meaning inside that local network — the wider internet has no idea those addresses exist.

> [!TIP] Worked example — Host ↔ Server through NAT
>
> A host at <strong>10.0.0.1</strong> on a private network wants to reach a server at <strong>200.100.10.1</strong> on the internet, via a router whose public-facing IP is <strong>150.150.0.1</strong>:
>
> <strong>Hop</strong> | <strong>Source IP</strong> | <strong>Destination IP</strong>
>
> Host → Router | 10.0.0.1 | 200.100.10.1
>
> Router → Internet (after NAT) | <strong>150.150.0.1</strong> (rewritten) | 200.100.10.1
>
> The server only ever sees <strong>150.150.0.1</strong> as the source — it has no visibility into the private 10.0.0.1 address behind the router. On the way back, the router reverses the translation, rewriting the destination from 150.150.0.1 back to 10.0.0.1 so the reply reaches the correct internal host.

> [!TIP] Two devices, one router — subnetting in practice
>
> Device A at <strong>192.168.1.1</strong> wants to reach facebook.com, which resolves to <strong>192.168.7.1</strong> on a network with subnet range `192.168.1.1 – 192.168.2.1`. Device B sits at <strong>192.168.2.1</strong> on a separate subnet. The router/gateway in the middle is responsible for knowing which subnet a destination belongs to and routing accordingly — exactly the role subnet masks play in deciding "is this destination local, or does it need to be routed elsewhere."

# Why private IP ranges exist

Because IPv4 only offers \~4.3 billion addresses total — far fewer than the number of internet-connected devices worldwide — reserved private ranges (like 192.168.x.x, 10.x.x.x) can be reused identically inside millions of separate home/office networks without conflict, since NAT means only the router's single public IP needs to be globally unique.
