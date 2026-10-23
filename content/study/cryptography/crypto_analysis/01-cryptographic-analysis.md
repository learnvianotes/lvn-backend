---
id: 02ecd862-a7ec-76ec-89de-d05ef29a063e
key: topic:cryptography/crypto_analysis
subject: cryptography
topic: crypto_analysis
title: Cryptographic Analysis
slug: cryptographic-analysis
order: 1
---

Deep dive into algorithm choices, key sizes, Initialization Vectors, and security rationale.

# Cryptographic Choices

| Primitive Type | Algorithm Choice | Rationale &amp; Key Sizes | Misuse Risks |
| --- | --- | --- | --- |
| <strong>Asymmetric Keys</strong> | X25519 (ECDH) | 256-bit key size. High security, extremely fast key derivation. Native to browser WebCrypto API. | Reusing ephemeral keys indefinitely (mitigated by key rotation or Double Ratchet). |
| <strong>Symmetric Cipher</strong> | AES-256-GCM | 256-bit key. Galois Counter Mode provides <strong>AEAD</strong> (Authenticated Encryption with Associated Data). | <strong>IV Reuse:</strong> Reusing the same IV with the same key destroys confidentiality and integrity guarantees. |
| <strong>Key Derivation</strong> | HKDF (SHA-256) | Extracts and expands entropy from ECDH shared secrets to produce cryptographically strong symmetric keys. | Using raw DH shared secrets as symmetric keys directly without expansion. |
| <strong>Password KEK</strong> | Argon2id / PBKDF2 | Memory-hard hashing function to encrypt local key bundles on disk. | Using weak iterations or lack of unique salting leading to dictionary lookup attacks. |

# Critical Alert: The IV Rules

> [!WARNING]
>
> <strong>IMPORTANT:</strong> For <strong>AES-GCM</strong>, the Initialization Vector (IV) MUST be exactly 96-bits (12 bytes) and MUST be cryptographically random for every single message encrypted under the same session key. Never hardcode an IV or increment it predictably.
