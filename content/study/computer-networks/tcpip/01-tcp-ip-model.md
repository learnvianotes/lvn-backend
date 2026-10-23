---
id: 676d1b1b-5c90-701a-a872-4ca724e65c85
key: topic:computer-networks/tcpip
subject: computer-networks
topic: tcpip
title: TCP/IP Model
slug: tcp-ip-model
order: 1
---

The practical, simplified model the real internet is actually built on.

Also called the <strong>Internet Protocol Suite</strong>. While OSI is a 7-layer <em>conceptual</em> reference model used for teaching and design, TCP/IP is the simpler <strong>5-layer practical</strong> model that real-world networking protocols actually map onto.

| OSI (7 layers) | TCP/IP (5 layers) |
| --- | --- |
| Application, Presentation, Session | <strong>Application</strong> |
| Transport | <strong>Transport</strong> |
| Network | <strong>Network (Internet)</strong> |
| Data Link | <strong>Data Link</strong> |
| Physical | <strong>Physical</strong> |

> [!INFO] Key distinction
>
> <strong>OSI is concept-based</strong> — it exists to help engineers reason about and design networking systems in clean, separated responsibilities. <strong>TCP/IP is implementation-based</strong> — it's the actual model the internet runs on, where the top three OSI layers are collapsed into one practical Application layer.
