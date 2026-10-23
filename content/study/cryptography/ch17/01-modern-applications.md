---
id: 2ec29b04-96db-7f24-980e-e9b63056252b
key: topic:cryptography/ch17
subject: cryptography
topic: ch17
title: Modern Applications
slug: modern-applications
order: 1
---

Real-world cryptographic implementations: Signal's Double Ratchet, PGP, WireGuard, and Zero-Knowledge Proofs.

# 1. Signal Protocol: Double Ratchet &amp; X3DH

> [!INFO]
>
> The Signal Protocol is the industry standard for E2EE messaging.
>
> - <strong>X3DH (Extended Triple Diffie-Hellman):</strong> Establishes a shared secret session key between two parties, even if one is offline, using pre-published public keys.
> - <strong>Double Ratchet:</strong> Updates session keys dynamically for every message exchanged using a combination of KDF chains and ephemeral ECDH exchanges. This guarantees <strong>Forward Secrecy</strong> and <strong>Break-in Recovery</strong> (compromising one key does not expose past or future messages).

# 2. PGP (Pretty Good Privacy)

PGP encrypts emails and files using a hybrid model: <br>1. Plaintext is encrypted with a fast, random symmetric key (e.g. AES). <br>2. The symmetric key is encrypted using the recipient's public key (RSA) and appended to the message. <br>3. Recipient uses their private key to decrypt the symmetric key, then decrypts the message payload.

# 3. WireGuard VPN

A modern VPN protocol that uses <strong>Cryptographic Key Routing</strong>. It binds tunnel IP addresses to peer public keys, using Curve25519 (ECDH), ChaCha20-Poly1305 (encryption), and BLAKE2s (hashing) to provide faster, simpler connections than IPsec or OpenVPN.

# 4. Zero-Knowledge Proofs (ZKP)

ZKP is a cryptographic method that allows one party (the prover) to prove to another party (the verifier) that they know a secret value without revealing any information about the secret itself (e.g., proving identity without revealing the password).
