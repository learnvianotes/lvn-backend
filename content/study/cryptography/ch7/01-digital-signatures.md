---
id: b2b3b834-7552-7e46-808f-9eb07a1bebc9
key: topic:cryptography/ch7
subject: cryptography
topic: ch7
title: Digital Signatures
slug: digital-signatures
order: 1
---

Assuring authenticity, integrity, and non-repudiation using asymmetric key pairs.

# 1. Step-by-Step Signing and Verification Mechanics

> [!INFO]
>
> Asymmetric ciphers are slow and cannot process large files directly. Digital signatures solve this by hashing the message first, then encrypting the hash with the sender's private key.

> [!TIP] Signing Process (Sender A)
>
> 1. Sender computes the hash of message `M`: `h = H(M)`.
> 2. Sender encrypts hash `h` with their private key: `S = D(h, K_private_A)`.
> 3. Sender transmits message `M` and Signature `S` together.

> [!DANGER] Verification Process (Receiver B)
>
> 1. Receiver computes the hash of received message `M`: `h' = H(M)`.
> 2. Receiver decrypts signature `S` using Sender's public key: `h = E(S, K_public_A)`.
> 3. If `h' == h`, the signature is valid.

# 2. Mathematical Proof of RSA Signatures

Using the RSA key generation properties, where `e` and `d` are mathematically linked modular inverses:

`Signing: S = H(M)^d mod n | Verification: H(M)' = S^e mod n`<br><br>` Proof: S^e mod n = (H(M)^d)^e mod n = H(M)^(d*e) mod n = H(M)^1 mod n = H(M)`

Because only the owner has the private key `d`, only they can generate signature `S`. Anyone with the public key `e` can verify it, proving the message's origin (authentication) and that it has not been modified (integrity).
