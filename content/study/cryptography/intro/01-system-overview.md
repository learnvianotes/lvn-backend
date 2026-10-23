---
id: ae8da301-e12f-7b23-91e2-67ce7e137185
key: topic:cryptography/intro
subject: cryptography
topic: intro
title: System Overview
slug: system-overview
order: 1
---

Production-grade End-to-End Encrypted (E2EE) messaging architectures, trust boundaries, and communication strategies.

# E2EE Model Philosophy

> [!INFO]
>
> An <strong>End-to-End Encrypted (E2EE)</strong> message system ensures that payloads are encrypted on the sender's device and can only be decrypted on the recipient's device. The intermediate server handles routing and message persistence in a <strong>zero-knowledge</strong> manner — the backend never sees plaintext messages or keys.

# Core Architectural Pillars

> [!NOTE] Key Exchange Model
>
> <strong>Diffie-Hellman Key Exchange (ECDH):</strong> Ephemeral or double-ratchet models are used to establish unique session keys between participants. Public keys are registered on the database, allowing offline negotiation.

> [!NOTE] Message Encryption
>
> <strong>Authenticated Symmetric Encryption (AES-GCM):</strong> Message payloads are encrypted using a derived 256-bit symmetric session key with random 96-bit Initialization Vectors (IVs) and authentication tags to guarantee integrity.

> [!NOTE] Transport Channel
>
> <strong>Real-Time WebSockets (Socket.IO):</strong> Delivers low-latency message relaying between connected clients. Authentication occurs during the socket handshake using cryptographically signed tokens (JWTs).

> [!NOTE] Storage Strategy
>
> <strong>Encrypted persistence:</strong> The server stores the payload's `ciphertext`, `iv`, and `auth_tag`. Routing metadata (timestamps, sender/receiver IDs) is plaintext, but payloads are locked.

# Trust Boundaries &amp; Attack Surface

> [!TIP] Client-Side Secure Boundary
>
> - Private keys are generated locally and never transmitted to the network.
> - Private keys are decrypted in memory only using a key derived from password hashing (PBKDF2/Argon2).
> - Compromise of the database or transport channel does not expose message contents.

> [!DANGER] Remaining Attack Surface
>
> - <strong>Metadata Leakage:</strong> Server knows who is communicating, when, and how frequently.
> - <strong>XSS / Local Exploits:</strong> If keys are stored in localStorage, a cross-site scripting attack can leak them.
> - <strong>MITM Key Substitution:</strong> A malicious server could return its own public keys instead of the receiver's.
