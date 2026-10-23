---
id: 5ba8e9da-2247-7c67-8d78-9d0e9b3b1a33
key: topic:cryptography/sockets
subject: cryptography
topic: sockets
title: Socket Architecture
slug: socket-architecture
order: 1
---

Real-time message routing, connection handshakes, namespaces, and delivery verification flow.

# Connection Handshake &amp; Auth

> [!INFO]
>
> To prevent unauthorized messaging, the socket connection performs a cryptographically validated handshake. Clients must pass a valid JWT in the connection query parameters:
>
> `const socket = io("https://chat.cnotes.io", {`<br>`  auth: { token: "JWT_TOKEN_HERE" }`<br>`});`
>
> The backend verifies the signature on the JWT. If invalid, the connection is immediately closed. Upon success, the socket associates the connection ID with the verified `userId`.

# Room &amp; Routing Configuration

Each user joins their own private notification room `user_<userId>` on connect. This design avoids shared room states and prevents information leakage.

> [!NOTE] 1. Join Room
>
> On connection, the backend calls `socket.join("user_" + socket.userId)`. All incoming payloads for this user are emitted directly to this targeted room.

> [!NOTE] 2. Delivery Acks
>
> When User A sends a message to User B, User A registers a callback handler. When User B receives and decrypts the message, they emit a delivery receipt back to the server, resolving the callback.

# Real-time Lifecycle Stages

connect → authenticate JWT → join "user\_uuid" → relay payload → persist ciphertext → delivery ack
