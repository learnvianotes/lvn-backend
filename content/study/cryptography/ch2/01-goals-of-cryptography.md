---
id: ecc3c9d0-d066-74bf-bb0e-fda0463b7153
key: topic:cryptography/ch2
subject: cryptography
topic: ch2
title: Goals of Cryptography
slug: goals-of-cryptography
order: 1
---

The core pillars of information security (CIA triad + Non-Repudiation) and their cryptographic enforcement.

# 1. Core Guarantees &amp; Cryptographic Primitives

| Goal | Definition | Threat Model Vector | Cryptographic Primitive |
| --- | --- | --- | --- |
| <strong>Confidentiality</strong> | Ensures unauthorized entities cannot read the payload data. | Passive Eavesdropping, Man-in-the-Middle sniffing. | Symmetric Encryption (AES-GCM, ChaCha20), Asymmetric Encryption (RSA, ECIES). |
| <strong>Integrity</strong> | Guarantees data has not been modified, deleted, or added to in transit. | Active Tampering, bit-flipping attacks, data corruption. | Cryptographic Hash Functions (SHA-256, SHA-3), Message Authentication Codes (HMAC). |
| <strong>Authentication</strong> | Verifies the true identity of the communication peer. | Identity spoofing, impersonation, phishing. | Digital Certificates (X.509), Digital Signatures (ECDSA), challenge-response handshakes. |
| <strong>Non-Repudiation</strong> | Prevents the sender from denying they generated or sent a payload. | Fraudulent denial of transactions, message forging. | Asymmetric Digital Signatures (only the owner of the private key could sign the message). |

# 2. Breach Scenarios &amp; Real-World Impacts

> [!TIP] How Goals are Met in HTTPS
>
> - <strong>Confidentiality:</strong> Payload encrypted using AES-GCM symmetric session keys.
> - <strong>Integrity:</strong> Handshake messages checked with SHA-256 MAC tags.
> - <strong>Authentication:</strong> Server certificate verified against Root CAs.

> [!DANGER] Typical Security Failures
>
> - <strong>Confidentiality Breach:</strong> Storing passwords or API keys in plaintext inside databases.
> - <strong>Integrity Failure:</strong> Relaying database records without signature tags, allowing parameter manipulation.
> - <strong>Authentication Spoofing:</strong> Trusting client-declared headers (e.g. X-User-ID) without JWT verification.
