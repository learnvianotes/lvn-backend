---
id: 647211bb-d75f-7152-98c6-3d239e5b149b
key: topic:cryptography/diagrams
subject: cryptography
topic: diagrams
title: System Diagrams
slug: system-diagrams
order: 1
---

Text diagrams detailing secure handshakes and persistent message flows.

# 1. Key Exchange Handshake (ECDH)

```
User A (Private a, Pub A=aG)                     User B (Private b, Pub B=bG)
      |                                                |
      |------------ [1. Upload PubKey A] ------------->| (Server Store)
      |                                                |
      |<----------- [2. Download PubKey B] ------------| (Server Retrieval)
      |                                                |
      |-- Derives shared secret S = a * Pub B (abG) ---|
      |-- Runs through HKDF -> Symmetric Session Key --|
```

# 2. Message Flow Routing Lifecycle

```
+---------+         +---------+         +-----------+         +--------+
| ClientA |         | Backend |         |  Database |         |ClientB |
+---------+         +---------+         +-----------+         +--------+
     |                   |                    |                    |
     |--[AES Encrypt]    |                    |                    |
     |                   |                    |                    |
     |--- websocket ---->|                    |                    |
     |    {ct, iv, tag}  |                    |                    |
     |                   |-- db.insert ------>|                    |
     |                   |   {ct, iv, tag}    |                    |
     |                   |                    |                    |
     |                   |----------- websocket -------------->|
     |                   |            {ct, iv, tag}            |
     |                   |                                     |
     |                   |                                [AES Decrypt]
     |                   |<---------- ack delivery ------------|
     |<-- ack delivery --|                                     |
```
